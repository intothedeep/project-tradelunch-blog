"""Pure: latest history rows -> a ``SnapshotRow`` for market_snapshots.

Computes BOTH change columns (the schema has two, both NOT NULL):
  change_absolute = latest.close - prev.close
  change_percent  = (latest.close - prev.close) / prev.close * 100
Synthesizes the snapshot meta: ``as_of`` = latest bar date, ``revalidate_seconds``
= per-category map, ``fetched_at`` = passed in (keeps the function deterministic).
For ``stocks`` it also sets ``ticker`` (= label) and ``exchange`` (the reader
returns these and the client union is non-null).

Invariants: deterministic; no side effects. Returns ``None`` when there is not
even one bar (nothing to snapshot — caller skips the symbol).
"""

from __future__ import annotations

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
    if not history:
        return None
    latest = history[-1]
    prev = history[-2] if len(history) >= 2 else None

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
