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
        candles.append(
            {
                "date": rec[date_col],
                "open": rec["Open"],
                "high": rec["High"],
                "low": rec["Low"],
                "close": rec["Close"],
                "volume": rec["Volume"],
            }
        )
    return candles


def fetch_marketcap_sector(symbol: str) -> tuple[float | None, str | None]:
    """Best-effort (market_cap, sector) for weekly ranking. (None, None) on error.

    Uses fast_info for market cap (cheap) and .info for sector (1 call). Partial
    results are fine — the caller records None and ranks it last / carries forward.
    """
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        for_provider(PROVIDER_YAHOO).acquire()
        ticker = yf.Ticker(symbol)
        market_cap: float | None = None
        sector: str | None = None
        try:
            fi = ticker.fast_info
            market_cap = fi.get("market_cap") or fi.get("marketCap")  # type: ignore[union-attr]
        except Exception:
            pass
        try:
            sector = ticker.info.get("sector")  # type: ignore[union-attr]
        except Exception:
            pass
        return (float(market_cap) if market_cap else None), sector
    except Exception:
        return None, None


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
