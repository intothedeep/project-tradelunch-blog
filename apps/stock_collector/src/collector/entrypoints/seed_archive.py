"""One-shot: SEED the Parquet archive with FULL history from inception (period='max').

Archive-only — does NOT touch the DB. Run manually when first enabling the
archive so the complete backfill (not a bounded window) lands in Parquet before
a retention prune can trust the archive as the sole deep-history copy.
Idempotent: ``parquet_sink`` read-merge-rewrite de-dupes by date, and it writes
the SAME partitions as ``run_daily --archive`` (keyed by Yahoo symbol).

Uses ``fetch_full`` (yfinance ``period='max'``) instead of ``fetch_daily`` so that
crypto symbols (BTC, ETH, …) get full history from 2014, not a clamped ~1-month
window that an early date would produce.

Universe = watchlist ∪ active tracked_symbols (tracked read only if a DB URL is
set; graceful otherwise). Side effects: network (Yahoo) + filesystem (Parquet);
the Storage upload is a separate step (``upload_archive``).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from collector.config.settings import database_url, parquet_dir
from collector.config.watchlist_loader import load_watchlist
from collector.sink import db_sink, parquet_sink
from collector.sink.yahoo_fetch import fetch_full
from collector.transform.archive import to_parquet_records
from collector.transform.universe_resolve import resolve_universe
from lib.constants import PROVIDER_YAHOO, safe_symbol


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
    parser = argparse.ArgumentParser(
        description="Seed the Parquet archive with FULL history from inception"
    )
    parser.add_argument("--limit", type=int, default=0, help="cap symbols (0=all)")
    # --full is the ONLY fetch mode; kept as an explicit flag so callers can
    # be self-documenting. Defaulting to True makes it safe to invoke bare.
    parser.add_argument(
        "--full",
        action="store_true",
        default=True,
        help="fetch full history via period='max' (default ON; only mode supported)",
    )
    args = parser.parse_args(argv)

    universe = resolve_universe(load_watchlist(), _tracked())
    targets = universe[: args.limit] if args.limit else universe
    base: Path = parquet_dir()

    total = 0
    skipped = 0
    for e in targets:
        # fetch_full uses period='max' — reaches true inception for every asset
        # class (crypto would be clamped to ~1 month with an early date in
        # fetch_daily; see yahoo_fetch.fetch_full docstring for the full WHY).
        candles = fetch_full(e.symbol)
        by_year = to_parquet_records(e.symbol, candles)
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
