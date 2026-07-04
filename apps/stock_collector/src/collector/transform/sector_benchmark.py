"""Pure: market-cap-weighted sector index benchmark for abnormal return (Phase S).

Given injected sector member data, compute a cap-weighted index return series
that is ready to drop into cumulative_abnormal_return(..., benchmark_series=...).

Invariants:
  - Weights are fixed at t0 = the first bar on or after ``gate`` that at least
    one member has data for. Members missing t0 price or with null/zero shares
    are excluded from the index (they never affect weighting).
  - The output is a list[tuple[date, float]] whose float values are normalised
    so that index(t0) = 1.0. This lets cumulative_abnormal_return treat the series
    as a pseudo-price and compute (bm_exit - bm_entry) / bm_entry correctly.
  - Alignment is positional: the series is sliced from gate, matching
    cumulative_abnormal_return's bar-position slicing for the stock series.
  - When a member has no price on a given date, its contribution to that bar is
    excluded and the remaining weights are renormalised for that bar only.
  - Returns [] on empty sector, all-excluded members, or zero total cap at t0.
  - Deterministic: same inputs → same output.

Side effects: none.
"""

from __future__ import annotations

from datetime import date
from typing import NamedTuple

__all__ = [
    "SectorMember",
    "build_sector_index",
]


class SectorMember(NamedTuple):
    """Input shape for one sector member."""

    shares_outstanding: float
    prices: list[tuple[date, float]]  # ascending (date, close)


def build_sector_index(
    members: list[SectorMember],
    gate: date,
    num_bars: int,
) -> list[tuple[date, float]]:
    """Compute a cap-weighted sector index series starting from ``gate``.

    The returned list of (date, index_value) is suitable as the
    ``benchmark_series`` argument of cumulative_abnormal_return.  At t0 the
    index value equals 1.0; subsequent values reflect the weighted cumulative
    return of the sector, so the event-study subtraction yields the true
    sector-relative abnormal return.

    Weight construction (fixed at t0):
        w_i = shares_i × close_i(t0) / Σ_j shares_j × close_j(t0)

    Index value at date d:
        index(d) = Σ_i w_i × (close_i(d) / close_i(t0))
                   ------ using only members with data on d, renormalised ------

    Args:
        members:  list of SectorMember(shares_outstanding, ascending price pairs).
        gate:     first eligible date (event_window_start result; bars >= gate used).
        num_bars: maximum output length (matches the stock price window cap).

    Returns:
        Ascending (date, index_value) list; empty when no member survives filter.
    """
    if not members:
        return []

    # --- filter and slice each member to bars >= gate -----------------------
    sliced: list[tuple[float, dict[date, float]]] = []
    for m in members:
        if not (m.shares_outstanding and m.shares_outstanding > 0.0):
            continue
        bars = {d: c for d, c in m.prices if d >= gate}
        if bars:
            sliced.append((m.shares_outstanding, bars))

    if not sliced:
        return []

    # --- t0: earliest date across all surviving members ---------------------
    t0 = min(min(bd) for _, bd in sliced)

    # --- anchor members to those with a valid t0 price ---------------------
    anchored: list[tuple[float, dict[date, float], float]] = []  # (shares, bars, t0_close)
    for shares, bars in sliced:
        t0_close = bars.get(t0)
        if t0_close is None or t0_close == 0.0:
            continue
        anchored.append((shares, bars, t0_close))

    if not anchored:
        return []

    # --- cap weights fixed at t0 -------------------------------------------
    total_cap = sum(s * t0c for s, _, t0c in anchored)
    if total_cap == 0.0:
        return []

    weights = [s * t0c / total_cap for s, _, t0c in anchored]
    # pre-extract for inner loop clarity
    bars_list = [bd for _, bd, _ in anchored]
    t0_closes = [t0c for _, _, t0c in anchored]

    # --- union of all dates, ascending, capped at num_bars -----------------
    all_dates = sorted({d for bd in bars_list for d in bd})[:num_bars]

    # --- compute index value per date ---------------------------------------
    result: list[tuple[date, float]] = []
    for d in all_dates:
        idx_val = 0.0
        w_sum = 0.0
        for w, bd, t0c in zip(weights, bars_list, t0_closes):
            close = bd.get(d)
            if close is None:
                continue
            idx_val += w * (close / t0c)
            w_sum += w
        if w_sum > 0.0:
            # Renormalise so missing members on this date don't deflate the index.
            result.append((d, idx_val / w_sum))

    return result
