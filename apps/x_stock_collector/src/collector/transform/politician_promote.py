"""Pure: select top-N politician-traded tickers for tracked_symbols promotion.

Purpose: given a pre-fetched list of PoliticianTickerRow (ticker, distinct_filers,
trade_count) and an exclude-set (watchlist symbols/labels + tracked symbols/labels),
apply validity filtering, deduplication, top-N cap, and return TrackedSymbol rows
ready for upsert_tracked_symbols.

Invariants:
  * No I/O — fully deterministic given the same inputs.
  * Validity rule: reject 9-char CUSIP-like tokens (len==9 with both digits and
    letters), reject tokens with spaces or any lowercase letter, keep only
    tokens matching [A-Z][A-Z0-9.\\-]{0,6}.
  * Ordering: distinct_filers DESC, trade_count DESC, ticker ASC (deterministic).
  * Label=ticker=symbol for promoted rows; skip on any exclude-set collision.
  * STICKY: additive only — never removes rows.

Side effects: none.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from collector.schema.rows import TrackedSymbol

# Yahoo-normalized equity tickers: 1-7 uppercase chars, letters/digits/dot/dash.
_VALID_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,6}$")

TOP_N = 75


@dataclass(frozen=True)
class PoliticianTickerRow:
    """One aggregated row from the politician_trades GROUP BY query.

    ``distinct_filers`` = COUNT(DISTINCT filer_id) — the breadth signal.
    ``trade_count``     = COUNT(*) — tie-break secondary sort.
    """

    ticker: str
    distinct_filers: int
    trade_count: int


def _is_valid_equity_ticker(ticker: str) -> bool:
    """True when ticker passes all validity guards.

    Checks (in order — early-exit on first rejection):
      1. No spaces.
      2. No lowercase letters.
      3. Not a 9-char CUSIP-like token (len==9 with BOTH digits and letters).
      4. Matches [A-Z][A-Z0-9.\\-]{0,6} (max 7 chars, uppercase/digit/dot/dash).
    """
    if " " in ticker:
        return False
    if any(c.islower() for c in ticker):
        return False
    if (
        len(ticker) == 9
        and any(c.isdigit() for c in ticker)
        and any(c.isalpha() for c in ticker)
    ):
        return False
    return bool(_VALID_TICKER_RE.match(ticker))


def select_politician_tickers(
    rows: Sequence[PoliticianTickerRow],
    exclude: frozenset[str],
    n: int = TOP_N,
) -> tuple[list[TrackedSymbol], dict[str, int]]:
    """Pure: filter, rank, cap, return TrackedSymbol rows to upsert.

    Args:
        rows: raw GROUP BY output — may be unsorted; ordering applied here.
        exclude: union of all watchlist symbols, watchlist labels, tracked
                 symbols, and tracked labels. Since label=ticker=symbol for
                 promoted rows, a single frozenset covers all collision checks.
        n: promotion cap (default 75).

    Returns:
        (tracked_rows, stats) where stats keys:
          candidates_considered, already_tracked_skipped,
          invalid_skipped, promoted.
    """
    # Deterministic sort: breadth DESC, volume DESC, ticker ASC.
    sorted_rows = sorted(
        rows,
        key=lambda r: (-r.distinct_filers, -r.trade_count, r.ticker),
    )

    candidates_considered = len(sorted_rows)
    already_tracked_skipped = 0
    invalid_skipped = 0
    promoted: list[TrackedSymbol] = []

    for row in sorted_rows:
        if len(promoted) >= n:
            break
        ticker = row.ticker
        if ticker in exclude:
            already_tracked_skipped += 1
            continue
        if not _is_valid_equity_ticker(ticker):
            invalid_skipped += 1
            continue
        # label=ticker must not collide with any existing label (re-check after
        # validity — the exclude set covers labels too, so this is belt-and-suspenders).
        if ticker in exclude:
            already_tracked_skipped += 1
            continue
        promoted.append(
            TrackedSymbol(
                symbol=ticker,
                category="stocks",
                label=ticker,
                sector=None,
                source="yahoo",
                exchange="US",
            )
        )

    stats = {
        "candidates_considered": candidates_considered,
        "already_tracked_skipped": already_tracked_skipped,
        "invalid_skipped": invalid_skipped,
        "promoted": len(promoted),
    }
    return promoted, stats
