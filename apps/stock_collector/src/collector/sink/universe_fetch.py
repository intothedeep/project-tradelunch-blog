"""IO boundary: fetch the large-cap candidate symbol pool for weekly ranking.

Primary source = the parser-stable GitHub ``datasets/s-and-p-500-companies`` CSV
(Massive is NOT a dependency). Nasdaq-100 + iShares IWB (Russell 1000) can be
added as extra sources to ``ranking.universe.assemble``; kept minimal here.

Graceful: any network/parse error -> ``[]`` (the weekly run logs and proceeds
with whatever sources succeeded). Side effects: network only.
"""

from __future__ import annotations

import csv
import io

import requests

_SP500_CSV = (
    "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/"
    "main/data/constituents.csv"
)
_TIMEOUT = 30


def fetch_sp500_symbols() -> list[str]:
    """Return S&P 500 tickers from the GitHub datasets CSV; ``[]`` on failure."""
    try:
        resp = requests.get(_SP500_CSV, timeout=_TIMEOUT)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))
        out: list[str] = []
        for row in reader:
            sym = (row.get("Symbol") or row.get("symbol") or "").strip()
            if sym:
                out.append(sym)
        return out
    except Exception:
        return []
