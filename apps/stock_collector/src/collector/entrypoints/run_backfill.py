"""Entrypoint: SEC 13F historical backfill collector (Phase L).

Flow: for each fund in configs/funds.yaml -> fetch submissions (all pages) ->
merge pages -> parse all 13F refs -> filter by since -> group by period ->
for each period ascending: pick best amendment -> fetch + parse infotable ->
[if period >= db_keep_cutoff] upsert filing + holdings + supersede prior ->
[if --archive] write Parquet (ALL periods, regardless of DB gate).

Partial-failure tolerant per (fund, period): each failure is caught, printed,
counted, and the run continues. Top-level unexpected error sets status='failed'
and re-raises so the batch_log row still lands via the finally block.

--since defaults to ~2 years ago (Jan 1 of year-2). Pass YYYY or YYYY-MM-DD
to override. --cik restricts to a single fund.

--db-keep-quarters (default 12 = 3 years): the DB write window. Periods older
than db_keep_cutoff(today, keep_quarters) skip DB upserts but still go to the
Parquet cold-archive when --archive is set. This decouples the full history
archive from the free-tier Postgres serving window.

Side effects: network (SEC EDGAR) + DB writes in non-dry mode.

L16: After each (fund, period) holdings fetch, write holdings to local 13F
Parquet and upload to Storage (best-effort, default OFF). Gated by
``COLLECTOR_ARCHIVE_SEC_PARQUET=1`` or ``--archive`` flag. Archive failures
log a warning and do NOT abort the backfill.

L17: DB-window gate decouples archive window (--since) from DB window
(--db-keep-quarters). Parquet receives ALL periods; DB receives only recent.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.funds_loader import load_funds
from collector.config.settings import (
    database_url,
    sec_parquet_archive_enabled,
    sec_parquet_bucket,
    sec_parquet_dir,
    supabase_storage,
)
from collector.schema.rows import FilingRow
from collector.sink import db_sink, sec_db_sink
from collector.sink import sec_fetch
from collector.sink import sec_parquet_sink, storage_sink
from collector.sink.storage_sink import object_key
from collector.transform.retention import db_keep_cutoff
from collector.transform.sec_parse import (
    aggregate_holdings,
    all_13f,
    group_by_period,
    merge_submission_pages,
    parse_infotable,
    parse_submissions,
    units_for_period,
)

_DEFAULT_DB_KEEP_QUARTERS = 12


def _parse_since(value: str) -> date:
    """Parse --since: 'YYYY' -> Jan 1 of that year, or 'YYYY-MM-DD'."""
    try:
        return date(int(value), 1, 1) if len(value) == 4 else date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"--since must be YYYY or YYYY-MM-DD, got {value!r}"
        ) from exc


def _default_since() -> date:
    """~2 years ago, floored to Jan 1 (~8 quarters of backfill)."""
    today = date.today()
    return date(today.year - 2, 1, 1)


def _fetch_refs(cik: str, since: date):
    """Fetch all submission pages, merge, parse, filter. Returns list of FilingRef."""
    subs = sec_fetch.fetch_submissions(cik)
    page_names = sec_fetch.submission_page_names(subs)
    older_pages = [sec_fetch.fetch_submission_page(n) for n in page_names]
    merged = merge_submission_pages(subs["filings"]["recent"], older_pages)
    return all_13f(parse_submissions({"filings": {"recent": merged}}), since=since)


def _fetch_holdings(cik: str, keep):
    """Fetch + parse + aggregate holdings for one FilingRef. Returns list or None."""
    idx = sec_fetch.fetch_accession_index(cik, keep.accession)
    xml_name = sec_fetch.find_infotable_name(idx)
    if xml_name is None:
        return None
    xml = sec_fetch.fetch_infotable(cik, keep.accession, xml_name)
    raws = parse_infotable(xml)
    return aggregate_holdings(raws, cik=cik, accession=keep.accession, period=keep.period_of_report)


def _archive_parquet(holdings, cik: str, url: str | None, key: str | None, bucket: str) -> None:
    """Best-effort: write 13F parquet + upload to Storage. Never raises."""
    base = sec_parquet_dir()
    try:
        paths = sec_parquet_sink.write_holding_rows(base, cik, holdings)
    except Exception as exc:  # noqa: BLE001
        print(f"[run_backfill] WARN parquet write failed for {cik}: {exc}")
        return
    if not (url and key):
        return
    for path in paths:
        try:
            ok = storage_sink.upload_object(url, key, bucket, object_key(base, path), path.read_bytes())
            if not ok:
                print(f"[run_backfill] WARN Storage upload non-2xx: {object_key(base, path)}")
        except Exception as exc:  # noqa: BLE001
            print(f"[run_backfill] WARN Storage upload failed {path.name}: {exc}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SEC 13F historical backfill")
    parser.add_argument("--cik", type=str, default=None,
                        help="single fund CIK (10-char padded); default = all funds")
    parser.add_argument("--since", type=_parse_since, default=None,
                        help="backfill floor: YYYY or YYYY-MM-DD (default ~2yr ago)")
    parser.add_argument("--limit", type=int, default=0,
                        help="max funds to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="fetch+parse+print; no DB writes")
    parser.add_argument(
        "--archive", action="store_true", default=False,
        help="enable 13F Parquet cold-archive (overrides COLLECTOR_ARCHIVE_SEC_PARQUET)",
    )
    parser.add_argument(
        "--db-keep-quarters", type=int, default=_DEFAULT_DB_KEEP_QUARTERS,
        metavar="N",
        help=(
            "DB write window in quarters (default 12 = 3 years). "
            "Periods older than this cutoff skip DB upserts but still go to "
            "Parquet when --archive is set."
        ),
    )
    args = parser.parse_args(argv)

    since: date = args.since if args.since is not None else _default_since()
    # Inject today ONCE for determinism — never call date.today() inside the loop.
    today: date = date.today()
    cutoff: date = db_keep_cutoff(today, args.db_keep_quarters)

    funds = load_funds()
    if args.cik:
        target = args.cik.strip().zfill(10)
        funds = [f for f in funds if f.cik == target]
        if not funds:
            print(f"[run_backfill] CIK {target!r} not found in funds registry")
            return 1
    if args.limit:
        funds = funds[: args.limit]

    if args.dry_run or not database_url():
        return _run_dry(funds, since, cutoff=cutoff, archive=args.archive or sec_parquet_archive_enabled())
    return _run_live(funds, since, cutoff=cutoff, archive=args.archive or sec_parquet_archive_enabled())


def _run_dry(funds: list, since: date, *, cutoff: date, archive: bool = False) -> int:
    """Dry-run path: no DB writes. Prints archive count and DB-window count per fund."""
    funds_ok = skipped = failed_funds = 0
    archive_periods_total = db_periods_total = failed_periods = holdings_total = 0

    for f in funds:
        try:
            refs = _fetch_refs(f.cik, since)
            if not refs:
                print(f"[dry-run] {f.label} ({f.cik}): no 13F refs since {since} — skip")
                skipped += 1
                continue
            fund_ok = True
            fund_archive = fund_db = 0
            for period, group in sorted(group_by_period(refs).items()):
                keep = max(group, key=lambda r: (r.filing_date, r.accession))
                try:
                    holdings = _fetch_holdings(f.cik, keep)
                    if holdings is None:
                        print(
                            f"[dry-run] {f.label} ({f.cik}) period={period}"
                            f" accession={keep.accession}: no info-table XML — skip"
                        )
                        continue
                    n = len(holdings)
                    holdings_total += n
                    in_db_window = period >= cutoff
                    fund_archive += 1
                    archive_periods_total += 1
                    if in_db_window:
                        fund_db += 1
                        db_periods_total += 1
                    print(
                        f"[dry-run] {f.label} ({f.cik}) period={period}"
                        f" accession={keep.accession} holdings={n}"
                        f" archive=yes db={'yes' if in_db_window else 'no (cutoff=' + str(cutoff) + ')'}"
                    )
                except Exception as exc:  # noqa: BLE001
                    failed_periods += 1
                    fund_ok = False
                    print(f"[dry-run] {f.label} ({f.cik}) period={period}: FAILED {exc}")
            print(
                f"[dry-run] {f.label} ({f.cik}): archive={fund_archive} periods"
                f" db={fund_db} periods (cutoff={cutoff})"
            )
            if fund_ok:
                funds_ok += 1
        except Exception as exc:  # noqa: BLE001
            failed_funds += 1
            print(f"[dry-run] {f.label} ({f.cik}): FAILED {type(exc).__name__}: {exc}")

    print(
        f"[dry-run] done funds={len(funds)} ok={funds_ok}"
        f" archive_periods={archive_periods_total} db_periods={db_periods_total}"
        f" holdings={holdings_total} skipped={skipped}"
        f" failed_funds={failed_funds} failed_periods={failed_periods}"
        f" db_cutoff={cutoff}"
    )
    return 0


def _run_live(funds: list, since: date, *, cutoff: date, archive: bool = False) -> int:
    """Live path: upsert to DB for periods >= cutoff; Parquet receives ALL periods."""
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    parquet_url, parquet_key = supabase_storage() if archive else (None, None)
    parquet_bkt = sec_parquet_bucket()

    try:
        funds_ok = skipped = failed_funds = failed_periods = holdings_total = 0
        archive_periods_total = db_periods_total = 0

        for f in funds:
            try:
                refs = _fetch_refs(f.cik, since)
                if not refs:
                    print(f"[run_backfill] {f.label} ({f.cik}): no 13F refs since {since} — skip")
                    skipped += 1
                    continue

                fund_had_failure = False
                for period, group in sorted(group_by_period(refs).items()):
                    keep = max(group, key=lambda r: (r.filing_date, r.accession))
                    try:
                        holdings = _fetch_holdings(f.cik, keep)
                        if holdings is None:
                            print(
                                f"[run_backfill] {f.label} ({f.cik}) period={period}"
                                f" accession={keep.accession}: no info-table XML — skip"
                            )
                            continue

                        in_db_window = period >= cutoff

                        # DB upsert — only for periods within the keep window.
                        if in_db_window:
                            filing = FilingRow(
                                cik=f.cik, accession=keep.accession,
                                period_of_report=period, form_type=keep.form_type,
                                filer=f.label, filing_date=keep.filing_date,
                                value_units=units_for_period(period),
                            )
                            sec_db_sink.upsert_filings(conn, [filing])
                            sec_db_sink.upsert_holdings(conn, holdings)
                            sec_db_sink.supersede_prior_filings(
                                conn, cik=f.cik, period=period,
                                keep_accession=keep.accession,
                                keep_filing_date=keep.filing_date,
                            )
                            db_periods_total += 1
                        else:
                            print(
                                f"[run_backfill] {f.label} ({f.cik}) period={period}"
                                f" accession={keep.accession}: archive-only (before cutoff={cutoff})"
                            )

                        # L16/L17: Parquet archive — ALL periods regardless of DB gate.
                        if archive:
                            _archive_parquet(
                                holdings, f.cik, parquet_url, parquet_key, parquet_bkt
                            )

                        archive_periods_total += 1
                        holdings_total += len(holdings)
                        print(
                            f"[run_backfill] {f.label} ({f.cik}) period={period}"
                            f" accession={keep.accession} holdings={len(holdings)}"
                            f" db={'yes' if in_db_window else 'no'}"
                        )
                    except Exception as exc:  # noqa: BLE001
                        failed_periods += 1
                        fund_had_failure = True
                        print(f"[run_backfill] {f.label} ({f.cik}) period={period}: FAILED {exc}")

                if not fund_had_failure:
                    funds_ok += 1

            except Exception as exc:  # noqa: BLE001
                failed_funds += 1
                print(f"[run_backfill] {f.label} ({f.cik}): FAILED {type(exc).__name__}: {exc}")

        if failed_funds > 0 or failed_periods > 0:
            status = "failed"
        descr = (
            f"funds={len(funds)} ok={funds_ok}"
            f" archive_periods={archive_periods_total} db_periods={db_periods_total}"
            f" holdings={holdings_total} skipped={skipped}"
            f" failed_funds={failed_funds} failed_periods={failed_periods}"
            f" since={since} db_cutoff={cutoff}"
        )
        print(f"[run_backfill] {descr}")

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_backfill] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn, job="collector-backfill", status=status,
            started_at=started_at, finished_at=datetime.now(timezone.utc), descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
