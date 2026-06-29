"""SQLite-backed Yahoo Finance daily OHLCV download worker (no broker).

Claims pending Yahoo jobs in batches, fetches daily bars (interval="1d") per
symbol via yfinance, and marks them done/failed. OHLCV data is written as CSV
under data/yahoo/<SAFE_SYMBOL>/ (never stored in SQLite). Yahoo index symbols
carry path-unsafe chars (^VIX), so the directory + filename use safe_symbol()
while the in-file "symbol" column keeps the real symbol (caret intact).
"""

from __future__ import annotations

import csv
import sqlite3
import time
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Protocol

import lib.constants as _c  # DATA_DIR read at call time (tests monkeypatch it)
from lib.constants import PROVIDER_YAHOO, safe_symbol
from lib.job_queue import (
    connect,
    claim_next_batch,
    mark_done,
    mark_failed,
    reset_stale,
)
from lib.rate_limit import for_provider

if TYPE_CHECKING:  # pandas only used for typing; avoid hard import at module load
    import pandas as pd  # type: ignore[import-untyped]

YAHOO_FIELDS = [
    "symbol",
    "date",
    "open",
    "high",
    "low",
    "close",
    "adj_close",
    "volume",
]

STALE_TIMEOUT = 600  # seconds: reset crashed-worker in_progress jobs at startup
SHORT_PAUSE = 1  # seconds: pause between batches when work was done
BATCH_SIZE = 50


class YahooFetcher(Protocol):
    def __call__(
        self, symbol: str, start: str, end: str, interval: str = "1d"
    ) -> "pd.DataFrame": ...


def build_fetcher() -> YahooFetcher:
    """Return a closure that downloads daily bars via yfinance."""

    def _fetch(
        symbol: str, start: str, end: str, interval: str = "1d"
    ) -> "pd.DataFrame":
        import yfinance as yf  # type: ignore[import-untyped]

        return yf.Ticker(symbol).history(
            start=start, end=end, interval=interval, auto_adjust=False
        )

    return _fetch


def _exclusive_end(to_date: str) -> str:
    """yfinance end is exclusive; advance one day (filename keeps original to_date)."""
    return (date.fromisoformat(to_date) + timedelta(days=1)).isoformat()


def _yahoo_dir(symbol: str):  # type: ignore[no-untyped-def]
    """Per-symbol output dir; reads _c.DATA_DIR at call time (test-monkeypatchable)."""
    return _c.DATA_DIR / PROVIDER_YAHOO / safe_symbol(symbol)


def _to_int_volume(value: object) -> int:
    """Volume -> int; NaN/missing -> 0 (NaN != NaN)."""
    if value is None or value != value:  # noqa: PLR0124 (NaN check)
        return 0
    return int(float(str(value)))


def fetch_and_store_yahoo(
    fetch: YahooFetcher, symbol: str, from_date: str, to_date: str
) -> int:
    """Fetch daily bars for one symbol and write a CSV. Returns rows written."""
    for_provider(PROVIDER_YAHOO).acquire()
    df = fetch(symbol, from_date, _exclusive_end(to_date), "1d")

    if df is None or getattr(df, "empty", True):
        return 0

    df = df.reset_index()
    columns = list(df.columns)
    if "Date" in columns:
        date_col = "Date"
    elif "Datetime" in columns:
        date_col = "Datetime"
    else:
        date_col = columns[0]

    has_adj = "Adj Close" in columns

    out_dir = _yahoo_dir(symbol)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{safe_symbol(symbol)}_{from_date}_{to_date}.csv"

    count = 0
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=YAHOO_FIELDS)
        writer.writeheader()
        for _, row in df.iterrows():
            raw_date = row[date_col]
            date_str = raw_date.strftime("%Y-%m-%d")
            close = float(row["Close"])
            adj_close = float(row["Adj Close"]) if has_adj else close
            writer.writerow(
                {
                    "symbol": symbol,
                    "date": date_str,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": close,
                    "adj_close": adj_close,
                    "volume": _to_int_volume(row["Volume"]),
                }
            )
            count += 1
    return count


def run_batch(conn: sqlite3.Connection, fetch: YahooFetcher) -> int:
    """Claim up to BATCH_SIZE Yahoo jobs, fetch each, mark done/failed.

    Returns the number of jobs processed (success or failure). 0 means idle.
    """
    jobs = claim_next_batch(conn, PROVIDER_YAHOO, BATCH_SIZE)
    if not jobs:
        return 0

    for job in jobs:
        try:
            count = fetch_and_store_yahoo(
                fetch, job["ticker"], job["from_date"], job["to_date"]
            )
            mark_done(conn, job["id"], count)
        except Exception as e:
            msg = f"Yahoo job failed [{job['ticker']} {job['from_date']}..{job['to_date']}]: {e}"
            print(msg)
            mark_failed(conn, job["id"], str(e))

    return len(jobs)


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    conn = connect()
    reset_stale(conn, timeout_seconds=STALE_TIMEOUT)
    fetch = build_fetcher()

    while True:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print("실행:", timestamp)
        processed = run_batch(conn, fetch)
        time.sleep(SHORT_PAUSE if processed else 60)
