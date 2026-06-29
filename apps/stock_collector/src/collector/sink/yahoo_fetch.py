"""IO boundary: fetch daily OHLC candles from Yahoo (yfinance).

Reuses the copied ``yahoo_client.download_consumer.build_fetcher`` (yfinance
``Ticker.history(auto_adjust=False)`` -> raw close) + the ``lib.rate_limit``
token bucket. Returns plain candle dicts for the pure ``transform.ohlc``; no
CSV/sqlite-queue (the daily run is in-process for ~42 symbols).

Graceful: an empty frame, a network/parse error, or yfinance raising -> ``[]``
(that symbol is skipped; the run continues). Side effects: network only.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from lib.constants import PROVIDER_YAHOO
from lib.rate_limit import for_provider
from yahoo_client.download_consumer import build_fetcher

_fetcher = build_fetcher()

_COLS = ("Open", "High", "Low", "Close", "Volume")


def _num(value: Any, default: float | None = None) -> float | None:
    """NaN/None -> ``default``; else ``float(value)`` (NaN != NaN)."""
    if value is None or value != value:  # noqa: PLR0124 (NaN check)
        return default
    return float(value)


def _frame_to_candles(df: Any) -> list[dict[str, Any]]:
    if df is None or getattr(df, "empty", True):
        return []
    df = df.reset_index()
    cols = list(df.columns)
    date_col = "Date" if "Date" in cols else ("Datetime" if "Datetime" in cols else cols[0])
    if not all(c in cols for c in _COLS):
        return []
    candles: list[dict[str, Any]] = []
    for rec in df.to_dict("records"):
        close = rec["Close"]
        # auto_adjust=False keeps "Adj Close"; actions add "Dividends"/"Stock Splits".
        # OHLCV feeds market_history; the rest only the Parquet archive (Phase 1.5).
        candles.append(
            {
                "date": rec[date_col],
                "open": rec["Open"],
                "high": rec["High"],
                "low": rec["Low"],
                "close": close,
                "volume": rec["Volume"],
                "adj_close": _num(rec.get("Adj Close"), default=close),
                "dividends": _num(rec.get("Dividends")),
                "stock_splits": _num(rec.get("Stock Splits")),
            }
        )
    return candles


def fetch_shares_outstanding(symbol: str) -> float | None:
    """fast_info shares (CHEAP; monthly cache refresh). None on any error.

    Feeds market_cap = shares x local close, avoiding the per-symbol .info call.
    """
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        for_provider(PROVIDER_YAHOO).acquire()
        fi = yf.Ticker(symbol).fast_info
        shares = fi.get("shares") or fi.get("shares_outstanding")  # type: ignore[union-attr]
        return float(shares) if shares else None
    except Exception:
        return None


def fetch_sector(symbol: str) -> str | None:
    """`.info` sector (the EXPENSIVE, ban-prone call; quarterly cache only). None on error."""
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        for_provider(PROVIDER_YAHOO).acquire()
        return yf.Ticker(symbol).info.get("sector")  # type: ignore[union-attr]
    except Exception:
        return None


def fetch_market_cap(symbol: str) -> float | None:
    """fast_info market cap — FALLBACK when no local close exists yet. None on error."""
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        for_provider(PROVIDER_YAHOO).acquire()
        fi = yf.Ticker(symbol).fast_info
        mc = fi.get("market_cap") or fi.get("marketCap")  # type: ignore[union-attr]
        return float(mc) if mc else None
    except Exception:
        return None


def fetch_daily(symbol: str, from_date: date, to_date: date | None = None) -> list[dict[str, Any]]:
    """Fetch daily candles for ``symbol`` in [from_date, to_date]. ``[]`` on any gap/error."""
    end = (to_date or date.today()) + timedelta(days=1)  # yfinance end is exclusive
    if from_date > (to_date or date.today()):
        return []
    try:
        for_provider(PROVIDER_YAHOO).acquire()
        df = _fetcher(symbol, from_date.isoformat(), end.isoformat(), "1d")
    except Exception:
        return []
    return _frame_to_candles(df)
