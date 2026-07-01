"""Entrypoint: SEC 13F historical backfill collector (Phase L).

Flow: for each fund in configs/funds.yaml -> fetch submissions (all pages) ->
merge pages -> parse all 13F refs -> filter by since -> group by period ->
for each period ascending: reconcile_period_filings (NEW HOLDINGS awareness) ->
[if period >= db_keep_cutoff] ingest_period (upsert filing + holdings + supersede) ->
[if --archive] write Parquet (ALL periods, regardless of DB gate).

Partial-failure tolerant per (fund, period). --since defaults to ~2yr ago.
--db-keep-quarters (default 12 = 3yr): DB write window; older periods go to
Parquet only when --archive is set.

Side effects: network (SEC EDGAR) + DB writes in non-dry mode.
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
from collector.sink import db_sink, sec_fetch
from collector.sink import sec_parquet_sink, storage_sink
from collector.sink.sec_period_ingest import ingest_period
from collector.sink.storage_sink import object_key
from collector.transform.retention import db_keep_cutoff
from collector.transform.sec_parse import (
    aggregate_holdings,
    all_13f,
    group_by_period,
    merge_submission_pages,
    parse_infotable,
    parse_submissions,
)

_DEFAULT_DB_KEEP_QUARTERS = 12


def _parse_since(value: str) -> date:
    try:
        return date(int(value), 1, 1) if len(value) == 4 else date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"--since must be YYYY or YYYY-MM-DD, got {value!r}"
        ) from exc


def _default_since() -> date:
    today = date.today()
    return date(today.year - 2, 1, 1)


def _fetch_refs(cik: str, since: date):
    subs = sec_fetch.fetch_submissions(cik)
    page_names = sec_fetch.submission_page_names(subs)
    older_pages = [sec_fetch.fetch_submission_page(n) for n in page_names]
    merged = merge_submission_pages(subs["filings"]["recent"], older_pages)
    return all_13f(parse_submissions({"filings": {"recent": merged}}), since=since)


def _fetch_holdings_single(cik: str, ref):
    """Fetch + parse + aggregate for one FilingRef (archive-only path)."""
    idx = sec_fetch.fetch_accession_index(cik, ref.accession)
    xml_name = sec_fetch.find_infotable_name(idx)
    if xml_name is None:
        return None
    xml = sec_fetch.fetch_infotable(cik, ref.accession, xml_name)
    raws = parse_infotable(xml)
    return aggregate_holdings(raws, cik=cik, accession=ref.accession, period=ref.period_of_report)


def _archive_parquet(holdings, cik: str, url: str | None, key: str | None, bucket: str) -> None:
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
    parser.add_argument("--cik", type=str, default=None)
    parser.add_argument("--since", type=_parse_since, default=None)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--archive", action="store_true", default=False)
    parser.add_argument("--db-keep-quarters", type=int, default=_DEFAULT_DB_KEEP_QUARTERS, metavar="N")
    args = parser.parse_args(argv)

    since: date = args.since if args.since is not None else _default_since()
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

    archive_on = args.archive or sec_parquet_archive_enabled()
    if args.dry_run or not database_url():
        return _run_dry(funds, since, cutoff=cutoff, archive=archive_on)
    return _run_live(funds, since, cutoff=cutoff, archive=archive_on)


def _run_dry(funds: list, since: date, *, cutoff: date, archive: bool = False) -> int:
    funds_ok = skipped = failed_funds = failed_periods = holdings_total = 0
    archive_periods_total = db_periods_total = 0

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
                    holdings = _fetch_holdings_single(f.cik, keep)
                    if holdings is None:
                        print(f"[dry-run] {f.label} ({f.cik}) period={period}: no XML — skip")
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
                        f" group_size={len(group)} holdings={n}"
                        f" db={'yes' if in_db_window else 'no'}"
                    )
                except Exception as exc:  # noqa: BLE001
                    failed_periods += 1
                    fund_ok = False
                    print(f"[dry-run] {f.label} ({f.cik}) period={period}: FAILED {exc}")
            if fund_ok:
                funds_ok += 1
        except Exception as exc:  # noqa: BLE001
            failed_funds += 1
            print(f"[dry-run] {f.label} ({f.cik}): FAILED {type(exc).__name__}: {exc}")

    print(
        f"[dry-run] done funds={len(funds)} ok={funds_ok}"
        f" archive_periods={archive_periods_total} db_periods={db_periods_total}"
        f" holdings={holdings_total} skipped={skipped}"
        f" failed_funds={failed_funds} failed_periods={failed_periods} db_cutoff={cutoff}"
    )
    return 0


def _run_live(funds: list, since: date, *, cutoff: date, archive: bool = False) -> int:
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
                    try:
                        in_db_window = period >= cutoff
                        if in_db_window:
                            n_holdings, n_live, n_failed = ingest_period(
                                conn, cik=f.cik, label=f.label, period=period, group=group,
                            )
                            if n_failed:
                                failed_periods += n_failed
                                fund_had_failure = True
                            db_periods_total += 1
                            holdings_total += n_holdings
                            print(
                                f"[run_backfill] {f.label} ({f.cik}) period={period}"
                                f" live={n_live} holdings={n_holdings} db=yes"
                            )
                        else:
                            keep = max(group, key=lambda r: (r.filing_date, r.accession))
                            holdings = _fetch_holdings_single(f.cik, keep)
                            if holdings is None:
                                print(f"[run_backfill] {f.label} ({f.cik}) period={period}: no XML — skip")
                                continue
                            holdings_total += len(holdings)
                            if archive:
                                _archive_parquet(holdings, f.cik, parquet_url, parquet_key, parquet_bkt)
                            print(
                                f"[run_backfill] {f.label} ({f.cik}) period={period}"
                                f" holdings={len(holdings)} db=no (cutoff={cutoff})"
                            )

                        archive_periods_total += 1
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
