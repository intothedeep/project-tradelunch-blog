"""Enqueue Yahoo Finance daily download jobs into the SQLite job queue.

Usage:
    python src/yahoo_client/download_publisher.py --tickers indices \
        --from 1990-01-01 --to 2025-10-01
"""

import argparse
from datetime import datetime

import lib.constants
from lib.constants import DATA_DIR, PROVIDER_YAHOO
from lib.job_queue import connect, enqueue_bulk, preseed_done, status_counts

DEFAULT_INDICES = ["^VIX", "^GSPC", "^IXIC", "^DJI", "^RUT"]
DEFAULT_FROM = "1990-01-01"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enqueue Yahoo download jobs")
    parser.add_argument(
        "--tickers",
        type=str,
        default="indices",
        help="indices, a symbol, or comma-separated symbols (e.g. ^VIX,^GSPC)",
    )
    parser.add_argument(
        "--from",
        dest="start_date",
        type=str,
        default=DEFAULT_FROM,
        help="Start date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--to",
        dest="end_date",
        type=str,
        default=None,
        help="End date (YYYY-MM-DD); defaults to today",
    )
    parser.add_argument(
        "--preseed-existing",
        action="store_true",
        help="Mark already-downloaded ranges as done before enqueueing",
    )
    return parser.parse_args()


def get_symbol_list(arg: str) -> list[str]:
    if arg == "indices":
        return list(DEFAULT_INDICES)
    if "," in arg:
        return [s.strip() for s in arg.split(",") if s.strip()]
    return [arg]


def scan_existing_yahoo(base) -> list[tuple[str, str, str]]:  # type: ignore[no-untyped-def]
    """Scan data/yahoo/<dir>/*.csv -> [(real_symbol, from_date, to_date)].

    Index dirs are like '_VIX' (do NOT skip _-prefixed dirs). The real symbol is
    read from the first data row's 'symbol' column; from/to come from the
    filename stem via rsplit('_', 2). Missing base -> [].
    """
    items: list[tuple[str, str, str]] = []
    if not base.exists():
        return items
    import csv

    for sub in base.iterdir():
        if not sub.is_dir():
            continue
        for csv_file in sub.glob("*.csv"):
            stem = csv_file.stem
            parts = stem.rsplit("_", 2)
            if len(parts) != 3:
                continue
            _, from_date, to_date = parts
            with open(csv_file, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                first = next(reader, None)
            if first is None:
                continue
            real_symbol = first.get("symbol")
            if not real_symbol:
                continue
            items.append((real_symbol, from_date, to_date))
    return items


def main() -> None:
    args = parse_args()
    conn = connect()
    to_date = args.end_date or datetime.now().strftime("%Y-%m-%d")

    if args.preseed_existing:
        existing = scan_existing_yahoo(lib.constants.DATA_DIR / PROVIDER_YAHOO)
        seeded = preseed_done(conn, PROVIDER_YAHOO, existing)
        print(f"Preseeded {seeded} existing jobs as done")

    symbols = get_symbol_list(args.tickers)
    items = [(s, args.start_date, to_date) for s in symbols]
    inserted = enqueue_bulk(conn, PROVIDER_YAHOO, items)
    print(f">> symbols: {len(symbols)}")
    print(f">> date range: {args.start_date} .. {to_date}")
    print(f"Enqueued {inserted} new jobs")
    print("Status counts:", status_counts(conn, PROVIDER_YAHOO))


if __name__ == "__main__":
    main()
