"""Tests for collector.transform.politician_promote (pure functions only, no I/O).

Covers:
  * _is_valid_equity_ticker: normal keeps, space reject, lowercase reject,
    9-char CUSIP-like reject, dot/dash keeps, digit-start reject
  * select_politician_tickers:
    - CUSIP-like token counted as invalid_skipped
    - already-watchlisted/tracked ticker counted as already_tracked_skipped
    - lowercase/space token counted as invalid_skipped
    - valid tickers kept in correct order
    - tie-break ordering: distinct_filers DESC, trade_count DESC, ticker ASC
    - N cap: at most n rows returned even when more valid candidates exist
    - empty input returns empty list
    - exclude collision on label (ticker already a known label) is skipped
"""

from __future__ import annotations

import pytest

from collector.schema.rows import TrackedSymbol
from collector.transform.politician_promote import (
    _is_valid_equity_ticker,
    PoliticianTickerRow,
    select_politician_tickers,
)


# ---------------------------------------------------------------------------
# _is_valid_equity_ticker
# ---------------------------------------------------------------------------


def test_valid_simple():
    assert _is_valid_equity_ticker("AAPL") is True


def test_valid_with_dash():
    assert _is_valid_equity_ticker("BRK-B") is True


def test_valid_with_dot():
    assert _is_valid_equity_ticker("BRK.B") is True


def test_valid_single_char():
    assert _is_valid_equity_ticker("F") is True


def test_valid_seven_chars():
    # Max allowed by regex: 7 chars
    assert _is_valid_equity_ticker("ABCDEFG") is True


def test_reject_space():
    assert _is_valid_equity_ticker("BRK B") is False


def test_reject_lowercase_all():
    assert _is_valid_equity_ticker("goog") is False


def test_reject_lowercase_mixed():
    assert _is_valid_equity_ticker("AAPl") is False


def test_reject_digit_start():
    # Starts with digit -> fails regex
    assert _is_valid_equity_ticker("1AAPL") is False


def test_reject_empty():
    assert _is_valid_equity_ticker("") is False


def test_reject_too_long():
    # 8 chars -> fails [A-Z][A-Z0-9.\-]{0,6} (max 7)
    assert _is_valid_equity_ticker("ABCDEFGH") is False


def test_reject_9char_cusip_mixed():
    # 9 chars with both digits and letters: CUSIP-like
    assert _is_valid_equity_ticker("46625H100") is False


def test_reject_9char_alpha_only_fails_regex():
    # 9 chars, all letters: not CUSIP-like by the digits+letters rule,
    # but still fails the regex (max 7 chars) -> invalid
    assert _is_valid_equity_ticker("AAAAAAAAA") is False


def test_reject_9char_digits_only_fails_regex():
    # 9 chars, all digits: not CUSIP-like (no letters), fails regex (digit start)
    assert _is_valid_equity_ticker("037833100") is False


# ---------------------------------------------------------------------------
# Fixtures for select_politician_tickers
# ---------------------------------------------------------------------------


def _row(ticker: str, df: int, tc: int) -> PoliticianTickerRow:
    return PoliticianTickerRow(ticker=ticker, distinct_filers=df, trade_count=tc)


# Watchlist symbols and their labels (may differ in real usage, same here)
_WATCHLIST_EXCLUDE = frozenset({"AAPL", "MSFT"})

# Already-tracked symbols/labels
_TRACKED_EXCLUDE = frozenset({"NVDA"})

_EXCLUDE = _WATCHLIST_EXCLUDE | _TRACKED_EXCLUDE

_FIXTURE = [
    _row("46625H100", 50, 200),  # 9-char CUSIP-like -> invalid_skipped
    _row("AAPL", 45, 190),       # in exclude (watchlist) -> already_tracked_skipped
    _row("NVDA", 40, 180),       # in exclude (tracked)  -> already_tracked_skipped
    _row("goog", 38, 170),       # lowercase             -> invalid_skipped
    _row("META COM", 35, 160),   # space                 -> invalid_skipped
    _row("AMZN", 30, 150),       # valid keep #1
    _row("GOOGL", 28, 140),      # valid keep #2
    _row("TSLA", 28, 120),       # same df as GOOGL, fewer trades -> after GOOGL
    _row("META", 28, 120),       # same df+tc as TSLA -> tie-break ticker ASC: META < TSLA
    _row("LMT", 10, 50),         # valid keep #5 (lower breadth)
]


def test_valid_tickers_returned():
    promoted, _ = select_politician_tickers(_FIXTURE, _EXCLUDE)
    symbols = [r.symbol for r in promoted]
    assert "AMZN" in symbols
    assert "GOOGL" in symbols
    assert "META" in symbols
    assert "TSLA" in symbols
    assert "LMT" in symbols


def test_cusip_counted_as_invalid():
    _, stats = select_politician_tickers(_FIXTURE, _EXCLUDE)
    # 46625H100, goog, META COM = 3 invalid
    assert stats["invalid_skipped"] == 3


def test_exclude_counted_as_already_tracked():
    _, stats = select_politician_tickers(_FIXTURE, _EXCLUDE)
    # AAPL, NVDA = 2 skipped
    assert stats["already_tracked_skipped"] == 2


def test_promoted_count():
    _, stats = select_politician_tickers(_FIXTURE, _EXCLUDE)
    assert stats["promoted"] == 5  # AMZN, GOOGL, META, TSLA, LMT


def test_candidates_considered():
    _, stats = select_politician_tickers(_FIXTURE, _EXCLUDE)
    assert stats["candidates_considered"] == len(_FIXTURE)


def test_tie_break_ordering():
    """META and TSLA have equal df+tc -> ticker ASC means META before TSLA."""
    promoted, _ = select_politician_tickers(_FIXTURE, _EXCLUDE)
    symbols = [r.symbol for r in promoted]
    assert symbols.index("META") < symbols.index("TSLA")


def test_order_by_breadth_first():
    """AMZN (df=30) before GOOGL (df=28) even though GOOGL is listed later."""
    promoted, _ = select_politician_tickers(_FIXTURE, _EXCLUDE)
    symbols = [r.symbol for r in promoted]
    assert symbols.index("AMZN") < symbols.index("GOOGL")


def test_n_cap_limits_output():
    """When more valid candidates than n exist, only n rows are returned."""
    big_fixture = [_row(f"S{i:04d}", 100 - i, 200 - i) for i in range(200)]
    promoted, stats = select_politician_tickers(big_fixture, frozenset(), n=75)
    assert len(promoted) == 75
    assert stats["promoted"] == 75


def test_n_cap_small():
    promoted, stats = select_politician_tickers(_FIXTURE, _EXCLUDE, n=2)
    assert len(promoted) == 2
    assert stats["promoted"] == 2
    # Top 2 valid: AMZN (df=30), GOOGL (df=28)
    assert promoted[0].symbol == "AMZN"
    assert promoted[1].symbol == "GOOGL"


def test_empty_input():
    promoted, stats = select_politician_tickers([], frozenset())
    assert promoted == []
    assert stats["promoted"] == 0
    assert stats["candidates_considered"] == 0


def test_returned_rows_are_tracked_symbol():
    promoted, _ = select_politician_tickers(_FIXTURE, _EXCLUDE)
    for r in promoted:
        assert isinstance(r, TrackedSymbol)
        assert r.category == "stocks"
        assert r.exchange == "US"
        assert r.source == "yahoo"
        assert r.label == r.symbol  # label=ticker


def test_exclude_by_label_collision():
    """If a ticker matches an existing label, it is skipped as already_tracked."""
    # "NEWCO" would be a valid ticker, but suppose it's an existing tracked label.
    exclude = frozenset({"NEWCO"})
    rows = [_row("NEWCO", 100, 500)]
    promoted, stats = select_politician_tickers(rows, exclude)
    assert promoted == []
    assert stats["already_tracked_skipped"] == 1


def test_all_excluded_returns_empty():
    exclude = frozenset({"AMZN", "GOOGL", "META", "TSLA", "LMT"})
    # Only valid tickers in _FIXTURE are in exclude now
    promoted, stats = select_politician_tickers(_FIXTURE, _EXCLUDE | exclude)
    assert promoted == []
    assert stats["promoted"] == 0
