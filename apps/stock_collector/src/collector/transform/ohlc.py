"""Pure: raw OHLC candles -> typed ``HistoryRow`` list (keyed by label).

Input candle = a mapping with keys ``date, open, high, low, close, volume``
(as produced by the Yahoo consumer CSV / yfinance rows). Rows with a missing
or non-numeric OHLC field are skipped (graceful — Yahoo gaps must not abort a
run); ``date`` may be a ``datetime.date`` or an ISO ``YYYY-MM-DD`` string.

Invariants: deterministic; no side effects; output keyed by (label, interval,
bar_time) — history carries no category.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime
from typing import Any

from collector.schema.rows import DEFAULT_INTERVAL, HistoryRow


def _to_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _candle_to_row(
    label: str, interval: str, candle: Mapping[str, Any]
) -> HistoryRow | None:
    try:
        bar_time = _to_date(candle["date"])
        row = HistoryRow(
            label=label,
            interval=interval,
            bar_time=bar_time,
            open=float(candle["open"]),
            high=float(candle["high"]),
            low=float(candle["low"]),
            close=float(candle["close"]),
            volume=int(float(candle["volume"])),
        )
    except (KeyError, TypeError, ValueError):
        return None  # graceful skip of a malformed candle
    return row


def to_history_rows(
    label: str,
    candles: Iterable[Mapping[str, Any]],
    interval: str = DEFAULT_INTERVAL,
) -> list[HistoryRow]:
    """Convert candles to ``HistoryRow``s, sorted ascending by ``bar_time``.

    Malformed candles are dropped. Duplicate bar dates keep the LAST occurrence.
    """
    by_date: dict[date, HistoryRow] = {}
    for candle in candles:
        row = _candle_to_row(label, interval, candle)
        if row is not None:
            by_date[row.bar_time] = row
    return [by_date[d] for d in sorted(by_date)]
