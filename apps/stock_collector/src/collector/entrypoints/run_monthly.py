"""Entrypoint: MONTHLY SEC 13F institutional holdings collector.

Flow: for each fund in configs/funds.yaml -> fetch submissions -> pick latest
13F-HR (or 13F-HR/A) filing -> fetch info-table XML -> parse + aggregate
holdings -> upsert filing header + holdings rows + supersede prior same-period
filings (soft-delete strictly-earlier amendments).

Partial-failure tolerant: a single fund failure is caught, printed, counted as
failed, and the run continues. A top-level unexpected error sets status='failed'
and re-raises (so the batch_log row still lands via the finally block).

Side effects: network (SEC EDGAR — 3 GETs per fund) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.funds_loader import load_funds
from collector.config.settings import (
    database_url,
    sec_archive_enabled,
    sec_bucket,
    supabase_storage,
)
from collector.schema.rows import FilingRow
from collector.sink import db_sink, sec_db_sink, storage_sink
from collector.sink import sec_fetch
from collector.transform.sec_parse import (
    aggregate_holdings,
    latest_13f,
    parse_submissions,
    units_for_period,
    parse_infotable,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Monthly SEC 13F holdings collector")
    parser.add_argument("--limit", type=int, default=0, help="max funds to process (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="fetch+parse+print, no DB writes")
    args = parser.parse_args(argv)

    funds = load_funds()
    if args.limit:
        funds = funds[: args.limit]

    # --- dry-run path (no DB) -----------------------------------------------
    if args.dry_run or not database_url():
        funds_ok = 0
        holdings_total = 0
        skipped = 0
        failed = 0
        for f in funds:
            try:
                subs = sec_fetch.fetch_submissions(f.cik)
                ref = latest_13f(parse_submissions(subs))
                if ref is None:
                    print(f"[dry-run] {f.label} ({f.cik}): no 13F found — skip")
                    skipped += 1
                    continue
                idx = sec_fetch.fetch_accession_index(f.cik, ref.accession)
                name = sec_fetch.find_infotable_name(idx)
                if name is None:
                    print(f"[dry-run] {f.label} ({f.cik}): no info-table XML in index — skip")
                    skipped += 1
                    continue
                xml = sec_fetch.fetch_infotable(f.cik, ref.accession, name)
                raws = parse_infotable(xml)
                holdings = aggregate_holdings(
                    raws,
                    cik=f.cik,
                    accession=ref.accession,
                    period=ref.period_of_report,
                )
                n_holdings = len(holdings)
                holdings_total += n_holdings
                funds_ok += 1
                print(
                    f"[dry-run] {f.label} ({f.cik}): period={ref.period_of_report}"
                    f" accession={ref.accession} holdings={n_holdings}"
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"[dry-run] {f.label} ({f.cik}): FAILED {type(exc).__name__}: {exc}")
        print(
            f"[dry-run] done funds={len(funds)} ok={funds_ok}"
            f" holdings={holdings_total} skipped={skipped} failed={failed}"
        )
        return 0

    # --- live path ----------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""
    # Best-effort raw 13F archive (default OFF). Resolved once; per-fund upload
    # failures are swallowed by storage_sink (never abort collection).
    archive_on = sec_archive_enabled()
    archive_url, archive_key = supabase_storage() if archive_on else (None, None)
    archive_bucket = sec_bucket()
    try:
        funds_ok = 0
        holdings_total = 0
        skipped = 0
        failed = 0

        for f in funds:
            try:
                subs = sec_fetch.fetch_submissions(f.cik)
                ref = latest_13f(parse_submissions(subs))
                if ref is None:
                    print(f"[run_monthly] {f.label} ({f.cik}): no 13F found — skip")
                    skipped += 1
                    continue

                idx = sec_fetch.fetch_accession_index(f.cik, ref.accession)
                name = sec_fetch.find_infotable_name(idx)
                if name is None:
                    print(f"[run_monthly] {f.label} ({f.cik}): no info-table XML in index — skip")
                    skipped += 1
                    continue

                xml = sec_fetch.fetch_infotable(f.cik, ref.accession, name)
                if archive_on and archive_url and archive_key:
                    storage_sink.upload_object(
                        archive_url,
                        archive_key,
                        archive_bucket,
                        f"sec13f/{f.cik}/{ref.accession}/infotable.xml",
                        xml,
                    )
                raws = parse_infotable(xml)
                holdings = aggregate_holdings(
                    raws,
                    cik=f.cik,
                    accession=ref.accession,
                    period=ref.period_of_report,
                )

                filing = FilingRow(
                    cik=f.cik,
                    accession=ref.accession,
                    period_of_report=ref.period_of_report,
                    form_type=ref.form_type,
                    filer=f.label,
                    filing_date=ref.filing_date,
                    value_units=units_for_period(ref.period_of_report),
                )

                sec_db_sink.upsert_filings(conn, [filing])
                sec_db_sink.upsert_holdings(conn, holdings)
                sec_db_sink.supersede_prior_filings(
                    conn,
                    cik=f.cik,
                    period=ref.period_of_report,
                    keep_accession=ref.accession,
                    keep_filing_date=ref.filing_date,
                )

                n_holdings = len(holdings)
                holdings_total += n_holdings
                funds_ok += 1
                print(
                    f"[run_monthly] {f.label} ({f.cik}): period={ref.period_of_report}"
                    f" accession={ref.accession} holdings={n_holdings}"
                )

            except Exception as exc:  # noqa: BLE001 — partial-failure tolerant
                failed += 1
                print(
                    f"[run_monthly] {f.label} ({f.cik}): FAILED"
                    f" {type(exc).__name__}: {exc}"
                )

        # Any per-fund failure → mark the run failed (resolved=0) so it surfaces
        # in `WHERE resolved=0`; ok funds' data still persisted (committed inline).
        if failed > 0:
            status = "failed"
        descr = (
            f"funds={len(funds)} ok={funds_ok} holdings={holdings_total}"
            f" skipped={skipped} failed={failed}"
        )
        print(f"[run_monthly] {descr}")

    except Exception as exc:  # noqa: BLE001 — top-level unexpected error
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_monthly] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-monthly",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
