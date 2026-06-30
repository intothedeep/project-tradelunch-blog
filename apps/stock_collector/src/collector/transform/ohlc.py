"""Pure: raw OHLC candles -> typed ``HistoryRow`` list (keyed by label).

Input candle = a mapping with keys ``date, open, high, low, close, volume``
(as produced by the Yahoo consumer CSV / yfinance rows). Rows with a missing,
non-numeric, or ``NaN`` OHLC field are skipped (graceful — Yahoo gaps must not
abort a run); ``date`` may be a ``datetime.date`` or an ISO ``YYYY-MM-DD`` string.

NaN guard: yfinance emits a provisional latest bar with O/H/L filled but
``close=NaN`` (not-yet-settled session). ``float('nan')`` does NOT raise, so such
a bar would otherwise persist a NaN close — which propagates to the snapshot
(``value``/``change`` = NaN), serializes to JSON ``null``, and fails the
dashboard's non-null contract. We drop the bar instead.

Invariants: deterministic; no side effects; output keyed by (label, interval,
bar_time) — history carries no category.
"""

from __future__ import annotations

import math
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
        open_ = float(candle["open"])
        high = float(candle["high"])
        low = float(candle["low"])
        close = float(candle["close"])
        volume = int(float(candle["volume"]))
    except (KeyError, TypeError, ValueError):
        return None  # graceful skip of a malformed candle
    if math.isnan(open_) or math.isnan(high) or math.isnan(low) or math.isnan(close):
        return None  # provisional/gap bar with a NaN OHLC field — not a real observation
    return HistoryRow(
        label=label,
        interval=interval,
        bar_time=bar_time,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


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
