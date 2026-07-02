"""Pure: flag OHLC bars that fall on a non-trading day via cross-symbol consensus.

WHY: Yahoo/yfinance occasionally injects spurious bars on non-trading days
(weekends already filtered in transform/ohlc.py; holidays are not). Such glitch
bars appear for only a handful of symbols, while a REAL trading day has bars for
(almost) the whole exchange. So a date is a real trading day iff a consensus of a
large same-calendar reference group traded it; a bar on a date lacking that
consensus is a suspect.

Reliability is proportional to reference-group size: strong for the US universe
(~110 stocks incl. TQQQ/SOXL), unusable for tiny groups (KRX=2, FX=4) — those are
NOT covered here and need a real trading calendar (deferred; see 00.tasks.md).

Detection is LOG-ONLY (the caller records suspects to error_log); it never drops
rows — a false positive must not delete real data.

Invariants: deterministic; no side effects; no I/O.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Iterable, Protocol


class _BarLike(Protocol):
    label: str
    bar_time: date


def detect_isolated_bars(
    rows: Iterable[_BarLike],
    reference_labels: set[str],
    *,
    ratio: float = 0.5,
    min_active: int = 5,
) -> list[tuple[str, date]]:
    """Return ``(label, bar_time)`` suspects whose date lacks trading-day consensus.

    A reference label is ``active`` on a date when the date falls within that
    label's observed ``[min, max]`` bar_time span. A date is a real trading day
    when ``present >= ratio * active``; bars on dates below that (and with at
    least ``min_active`` active reference labels for context) are suspects.

    Only bars whose ``label`` is in ``reference_labels`` are judged — the consensus
    group and the judged set are the same same-calendar universe.
    """
    ref = [r for r in rows if r.label in reference_labels]
    present: dict[date, set[str]] = defaultdict(set)
    lo: dict[str, date] = {}
    hi: dict[str, date] = {}
    for r in ref:
        present[r.bar_time].add(r.label)
        if r.label not in lo or r.bar_time < lo[r.label]:
            lo[r.label] = r.bar_time
        if r.label not in hi or r.bar_time > hi[r.label]:
            hi[r.label] = r.bar_time

    labels = list(lo)
    suspects: list[tuple[str, date]] = []
    for d, present_labels in present.items():
        active = sum(1 for lbl in labels if lo[lbl] <= d <= hi[lbl])
        if active < min_active:
            continue  # too little same-calendar context to judge this date
        if len(present_labels) < ratio * active:
            for lbl in present_labels:
                suspects.append((lbl, d))
    return sorted(suspects)
