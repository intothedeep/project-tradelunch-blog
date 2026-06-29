"""Pure: raw candles -> per-year Parquet record batches (Phase 1.5 archive).

Input candle = a mapping with ``date, open, high, low, close, volume`` plus the
optional archive fields ``adj_close, dividends, stock_splits`` (as produced by
``sink.yahoo_fetch``). Output = ``{year: [records]}`` where each record matches
``sink.parquet_sink`` schema; the sink partitions one file per (ticker, year),
so candles spanning a backfill window are split by calendar year here.

Invariants: deterministic; no side effects. Malformed candles are dropped
(graceful — Yahoo gaps must not abort a run); duplicate bar dates within a year
keep the LAST occurrence; ``adj_close`` defaults to ``close`` when absent.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime
from typing import Any


def _to_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _record(symbol: str, candle: Mapping[str, Any]) -> dict[str, Any] | None:
    try:
        bar_date = _to_date(candle["date"])
        close = float(candle["close"])
        adj = candle.get("adj_close")
        return {
            "symbol": symbol,
            "date": bar_date,
            "open": float(candle["open"]),
            "high": float(candle["high"]),
            "low": float(candle["low"]),
            "close": close,
            "adj_close": float(adj) if adj is not None else close,
            "volume": int(float(candle["volume"])),
            "dividends": candle.get("dividends"),
            "stock_splits": candle.get("stock_splits"),
        }
    except (KeyError, TypeError, ValueError):
        return None  # graceful skip of a malformed candle


def to_parquet_records(
    symbol: str, candles: Iterable[Mapping[str, Any]]
) -> dict[int, list[dict[str, Any]]]:
    """Group candles into ``{year: [records]}``, date-deduped (keep last), sorted."""
    by_year: dict[int, dict[date, dict[str, Any]]] = {}
    for candle in candles:
        rec = _record(symbol, candle)
        if rec is None:
            continue
        by_year.setdefault(rec["date"].year, {})[rec["date"]] = rec
    return {year: [recs[d] for d in sorted(recs)] for year, recs in by_year.items()}
