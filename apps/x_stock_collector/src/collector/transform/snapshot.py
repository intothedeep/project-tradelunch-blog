"""Pure: latest history rows -> a ``SnapshotRow`` for market_snapshots.

Computes BOTH change columns (the schema has two, both NOT NULL):
  change_absolute = latest.close - prev.close
  change_percent  = (latest.close - prev.close) / prev.close * 100
Synthesizes the snapshot meta: ``as_of`` = latest bar date, ``revalidate_seconds``
= per-category map, ``fetched_at`` = passed in (keeps the function deterministic).
For ``stocks`` it also sets ``ticker`` (= label) and ``exchange`` (the reader
returns these and the client union is non-null).

Invariants: deterministic; no side effects. Returns ``None`` when there is not
even one usable bar (nothing to snapshot — caller skips the symbol).

NaN guard: bars whose ``close`` is NaN (a not-yet-settled yfinance bar that
slipped past an older ingest) are excluded before picking latest/prev, so the
snapshot's NOT-NULL ``value``/``change`` columns can never be NaN. The upstream
``ohlc`` transform already drops such bars on ingest; this defends the contract
against any NaN already resident in ``market_history``.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import datetime

from collector.schema.rows import (
    REVALIDATE_SECONDS,
    HistoryRow,
    SnapshotRow,
    WatchlistEntry,
)


def build_snapshot(
    entry: WatchlistEntry,
    history: Sequence[HistoryRow],
    fetched_at: datetime,
) -> SnapshotRow | None:
    """Build a snapshot from history sorted ascending by bar_time.

    With a single bar, change is 0.0 (first observation). With <1 bar -> None.
    """
    usable = [h for h in history if not math.isnan(h.close)]
    if not usable:
        return None
    latest = usable[-1]
    prev = usable[-2] if len(usable) >= 2 else None

    if prev is not None and prev.close != 0:
        change_absolute = latest.close - prev.close
        change_percent = (latest.close - prev.close) / prev.close * 100
    else:
        change_absolute = 0.0
        change_percent = 0.0

    is_stock = entry.category == "stocks"
    return SnapshotRow(
        category=entry.category,
        label=entry.label,
        value=latest.close,
        change_absolute=change_absolute,
        change_percent=change_percent,
        as_of=latest.bar_time,
        revalidate_seconds=REVALIDATE_SECONDS[entry.category],
        fetched_at=fetched_at,
        ticker=entry.label if is_stock else None,
        exchange=(entry.exchange or "US") if is_stock else None,
    )
