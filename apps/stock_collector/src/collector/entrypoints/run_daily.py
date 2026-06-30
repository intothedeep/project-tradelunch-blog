"""Entrypoint: DAILY OHLC ingest + snapshot refresh.

Flow (layer direction entrypoints -> config|transform -> sink):
  load watchlist -> read tracked_symbols (active) -> resolve_universe (yaml UNION
  tracked, yaml wins) -> per-label incremental from_date (max(bar_time)+1d) ->
  fetch Yahoo daily candles -> to_history_rows -> load_history ->
  read last 2 bars per label -> build_snapshot -> refresh_snapshots.

Yahoo-coverage rule: a symbol Yahoo can't serve yields no candles -> skipped;
the run continues (partial allowed, never aborts).

Side effects: network + DB writes (delegated to sink/).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from collector.config.settings import database_url, parquet_archive_enabled, parquet_dir
from collector.config.watchlist_loader import load_watchlist
from collector.schema.rows import DEFAULT_INTERVAL, WatchlistEntry
from collector.sink import db_sink, parquet_sink
from collector.sink.yahoo_fetch import fetch_daily
from collector.transform.archive import to_parquet_records
from collector.transform.ohlc import to_history_rows
from collector.transform.snapshot import build_snapshot
from collector.transform.universe_resolve import resolve_universe
from lib.constants import PROVIDER_YAHOO, safe_symbol

DEFAULT_BACKFILL_DAYS = 400  # ~252 trading bars on first run


def _from_date(
    entry: WatchlistEntry,
    latest: dict[str, date],
    backfill_days: int,
    full: bool = False,
) -> date:
    # --full forces inception (yfinance clamps to the symbol's first trade date),
    # ignoring both the incremental cursor and backfill_days. ON CONFLICT makes
    # the re-fetch idempotent.
    if full:
        return date(1970, 1, 1)
    last = latest.get(entry.label)
    if last is not None:
        return last + timedelta(days=1)
    return date.today() - timedelta(days=backfill_days)


def _archive(items: list[tuple[str, list]], base: Path) -> int:
    """Write each symbol's candles to its per-year Parquet partition. Returns rows."""
    total = 0
    for symbol, candles in items:
        ticker = safe_symbol(symbol)  # ^GSPC etc. carry path-unsafe chars
        for year, records in to_parquet_records(symbol, candles).items():
            parquet_sink.write_year(base, PROVIDER_YAHOO, ticker, year, records)
            total += len(records)
    return total


def _ingest(
    conn, universe, backfill_days, limit, archive, base, full=False
) -> tuple[int, int, int, int]:
    latest = db_sink.read_latest_bar(conn)
    targets = universe[:limit] if limit else universe
    all_rows = []
    archive_items: list[tuple[str, list]] = []
    skipped = 0
    for e in targets:
        candles = fetch_daily(e.symbol, _from_date(e, latest, backfill_days, full))
        rows = to_history_rows(e.label, candles, interval=DEFAULT_INTERVAL)
        if not rows:
            skipped += 1
            continue
        all_rows.extend(rows)
        if archive:
            archive_items.append((e.symbol, candles))
    written = db_sink.load_history(conn, all_rows)
    archived = _archive(archive_items, base) if archive else 0

    fetched_at = datetime.now(timezone.utc)
    snaps = []
    for e in targets:
        recent = db_sink.read_recent_history(conn, e.label, n=2)
        snap = build_snapshot(e, recent, fetched_at)
        if snap is not None:
            snaps.append(snap)
    snap_count = db_sink.refresh_snapshots(conn, snaps)
    return written, snap_count, skipped, archived


def _dry_run(universe, limit) -> int:
    n = limit or 5
    print(f"[dry-run] no DATABASE_URL — fetch-only smoke of {n} symbols")
    ok = 0
    for e in universe[:n]:
        candles = fetch_daily(e.symbol, date.today() - timedelta(days=10))
        rows = to_history_rows(e.label, candles)
        status = f"{len(rows)} bars" if rows else "SKIP (no Yahoo data)"
        print(f"  {e.category:8} {e.label:20} {e.symbol:12} -> {status}")
        ok += 1 if rows else 0
    print(f"[dry-run] {ok}/{n} returned data")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Daily OHLC + snapshot collector")
    parser.add_argument("--limit", type=int, default=0, help="cap symbols (0=all)")
    parser.add_argument("--backfill-days", type=int, default=DEFAULT_BACKFILL_DAYS)
    parser.add_argument("--dry-run", action="store_true", help="fetch-only, no DB")
    parser.add_argument(
        "--archive", action="store_true", help="also write the Phase-1.5 Parquet archive"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="backfill full history from inception (ignores cursor + backfill-days)",
    )
    args = parser.parse_args(argv)

    entries = load_watchlist()

    if args.dry_run or not database_url():
        universe = resolve_universe(entries, [])
        return _dry_run(universe, args.limit)

    archive = args.archive or parquet_archive_enabled()
    base = parquet_dir()
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""
    try:
        tracked = db_sink.read_tracked_symbols(conn)
        universe = resolve_universe(entries, tracked)
        written, snaps, skipped, archived = _ingest(
            conn, universe, args.backfill_days, args.limit, archive, base, args.full
        )
        descr = (
            f"universe={len(universe)}|history={written}|snapshots={snaps}"
            f"|skipped={skipped}|archived={archived}|full={int(args.full)}"
        )
        print(f"[run_daily] {descr}")
    except Exception as exc:  # noqa: BLE001 — record the failure row, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_daily] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-daily",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
