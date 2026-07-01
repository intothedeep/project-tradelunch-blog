"""Entrypoint: WEEKLY SEC 13F institutional holdings collector (L19: weekly cadence).

Flow: for each fund in configs/funds.yaml -> fetch submissions (1 GET) ->
``latest_13f`` -> L19 period-advance guard: if period_of_report <= stored
MAX(period_of_report) in DB -> SKIP (cheap no-op, no infotable fetch); else
-> fetch info-table XML -> parse + aggregate holdings -> upsert filing header +
holdings rows + supersede prior same-period filings (soft-delete strictly-earlier
amendments).

L19 cadence: cron changed from monthly (1st of month) to weekly (Monday 07:00 UTC).
Real heavy work fires only during the 4 quarterly 13F deadline windows (Feb/May/Aug/Nov);
the rest of the year submissions fetch is the only network call per fund.

Partial-failure tolerant: a single fund failure is caught, printed, counted as
failed, and the run continues. A top-level unexpected error sets status='failed'
and re-raises (so the batch_log row still lands via the finally block).

Side effects: network (SEC EDGAR — 1 GET baseline, 3 GETs when new quarter) +
DB writes in non-dry mode.

L16: After each fund's DB upsert, write holdings to local 13F Parquet and upload
to Storage (best-effort, default OFF). Gated by ``SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET=1``
or ``--archive`` flag. Archive failures log a warning but never abort collection.
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
    sec_parquet_archive_enabled,
    sec_parquet_bucket,
    sec_parquet_dir,
    supabase_storage,
)
from collector.schema.rows import FilingRow
from collector.sink import db_sink, sec_db_sink, storage_sink
from collector.sink import sec_fetch
from collector.sink import sec_parquet_sink
from collector.sink.storage_sink import object_key
from collector.transform.sec_parse import (
    aggregate_holdings,
    latest_13f,
    parse_submissions,
    units_for_period,
    parse_infotable,
)


def _archive_parquet(holdings, cik: str, url: str | None, key: str | None, bucket: str) -> None:
    """Best-effort: write 13F parquet + upload to Storage. Never raises."""
    base = sec_parquet_dir()
    try:
        paths = sec_parquet_sink.write_holding_rows(base, cik, holdings)
    except Exception as exc:  # noqa: BLE001
        print(f"[run_monthly] WARN parquet write failed for {cik}: {exc}")
        return
    if not (url and key):
        return
    for path in paths:
        try:
            ok = storage_sink.upload_object(url, key, bucket, object_key(base, path), path.read_bytes())
            if not ok:
                print(f"[run_monthly] WARN Storage upload non-2xx: {object_key(base, path)}")
        except Exception as exc:  # noqa: BLE001
            print(f"[run_monthly] WARN Storage upload failed {path.name}: {exc}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Weekly SEC 13F holdings collector (L19)")
    parser.add_argument("--limit", type=int, default=0, help="max funds to process (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="fetch+parse+print, no DB writes")
    parser.add_argument(
        "--archive", action="store_true", default=False,
        help="enable 13F Parquet cold-archive (overrides SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET)",
    )
    args = parser.parse_args(argv)

    funds = load_funds()
    if args.limit:
        funds = funds[: args.limit]

    # --- dry-run path (no DB) -----------------------------------------------
    if args.dry_run or not database_url():
        funds_ok = holdings_total = skipped = failed = 0
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
                    raws, cik=f.cik, accession=ref.accession, period=ref.period_of_report,
                )
                holdings_total += len(holdings)
                funds_ok += 1
                print(
                    f"[dry-run] {f.label} ({f.cik}): period={ref.period_of_report}"
                    f" accession={ref.accession} holdings={len(holdings)}"
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

    archive_on = sec_archive_enabled()
    archive_url, archive_key = supabase_storage() if archive_on else (None, None)
    archive_bucket = sec_bucket()

    # L16: 13F Parquet archive (default OFF). Best-effort; never aborts.
    parquet_on = args.archive or sec_parquet_archive_enabled()
    parquet_url, parquet_key = supabase_storage() if parquet_on else (None, None)
    parquet_bucket = sec_parquet_bucket()

    try:
        funds_ok = holdings_total = skipped = failed = 0

        for f in funds:
            try:
                # L19 period-advance guard: fetch submissions (1 GET) to get latest period.
                subs = sec_fetch.fetch_submissions(f.cik)
                ref = latest_13f(parse_submissions(subs))
                if ref is None:
                    print(f"[run_monthly] {f.label} ({f.cik}): no 13F found — skip")
                    skipped += 1
                    continue

                # L19: compare against stored MAX(period_of_report); skip if no new quarter.
                stored_period = sec_db_sink.read_latest_period(conn, f.cik)
                if stored_period is not None and ref.period_of_report <= stored_period:
                    print(
                        f"[run_monthly] {f.label} ({f.cik}): no new quarter"
                        f" (latest={ref.period_of_report}, stored={stored_period}) — skip"
                    )
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
                        archive_url, archive_key, archive_bucket,
                        f"sec13f/{f.cik}/{ref.accession}/infotable.xml", xml,
                    )
                raws = parse_infotable(xml)
                holdings = aggregate_holdings(
                    raws, cik=f.cik, accession=ref.accession, period=ref.period_of_report,
                )

                filing = FilingRow(
                    cik=f.cik, accession=ref.accession,
                    period_of_report=ref.period_of_report, form_type=ref.form_type,
                    filer=f.label, filing_date=ref.filing_date,
                    value_units=units_for_period(ref.period_of_report),
                )
                sec_db_sink.upsert_filings(conn, [filing])
                sec_db_sink.upsert_holdings(conn, holdings)
                sec_db_sink.supersede_prior_filings(
                    conn, cik=f.cik, period=ref.period_of_report,
                    keep_accession=ref.accession, keep_filing_date=ref.filing_date,
                )

                # L16: best-effort 13F Parquet archive (after DB write)
                if parquet_on:
                    _archive_parquet(holdings, f.cik, parquet_url, parquet_key, parquet_bucket)

                holdings_total += len(holdings)
                funds_ok += 1
                print(
                    f"[run_monthly] {f.label} ({f.cik}): period={ref.period_of_report}"
                    f" accession={ref.accession} holdings={len(holdings)}"
                )

            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"[run_monthly] {f.label} ({f.cik}): FAILED {type(exc).__name__}: {exc}")

        if failed > 0:
            status = "failed"
        descr = (
            f"funds={len(funds)} ok={funds_ok} holdings={holdings_total}"
            f" skipped={skipped} failed={failed}"
        )
        print(f"[run_monthly] {descr}")

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_monthly] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn, job="collector-monthly", status=status,
            started_at=started_at, finished_at=datetime.now(timezone.utc), descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
