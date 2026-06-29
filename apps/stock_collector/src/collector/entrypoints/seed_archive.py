"""One-shot: SEED the Parquet archive with FULL history (re-fetch from Yahoo).

Archive-only — does NOT touch the DB. Run manually when first enabling the
archive so the historical backfill (not just go-forward daily bars) lands in
Parquet. Idempotent: ``parquet_sink`` read-merge-rewrite de-dupes by date, and it
writes the SAME partitions as ``run_daily --archive`` (keyed by Yahoo symbol).

Universe = watchlist ∪ active tracked_symbols (tracked read only if a DB URL is
set; graceful otherwise). Side effects: network (Yahoo) + filesystem (Parquet);
the Storage upload is a separate step (``upload_archive``).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

from collector.config.settings import database_url, parquet_dir
from collector.config.watchlist_loader import load_watchlist
from collector.sink import db_sink, parquet_sink
from collector.sink.yahoo_fetch import fetch_daily
from collector.transform.archive import to_parquet_records
from collector.transform.universe_resolve import resolve_universe
from lib.constants import PROVIDER_YAHOO, safe_symbol

DEFAULT_BACKFILL_DAYS = 400  # ~252 trading bars


def _tracked() -> list:
    """Active sticky universe when a DB URL is set (graceful); else []."""
    if not database_url():
        return []
    conn = db_sink.connect()
    try:
        return db_sink.read_tracked_symbols(conn)
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the Parquet archive (full history)")
    parser.add_argument("--backfill-days", type=int, default=DEFAULT_BACKFILL_DAYS)
    parser.add_argument("--limit", type=int, default=0, help="cap symbols (0=all)")
    args = parser.parse_args(argv)

    universe = resolve_universe(load_watchlist(), _tracked())
    targets = universe[: args.limit] if args.limit else universe
    base: Path = parquet_dir()
    from_date = date.today() - timedelta(days=args.backfill_days)

    total = 0
    skipped = 0
    for e in targets:
        by_year = to_parquet_records(e.symbol, fetch_daily(e.symbol, from_date))
        if not by_year:
            skipped += 1  # Yahoo gap -> graceful skip
            continue
        ticker = safe_symbol(e.symbol)
        for year, records in by_year.items():
            parquet_sink.write_year(base, PROVIDER_YAHOO, ticker, year, records)
            total += len(records)
    print(f"[seed_archive] symbols={len(targets)} rows={total} skipped={skipped} -> {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
