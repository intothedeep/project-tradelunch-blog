"""Pure: politician-disclosure → price lead-lag transform (Phase T).

Purpose: given daily event-intensity and daily mean-return series (both
injected by the caller), compute lagged Pearson cross-correlations and
identify the optimal entry lag (the lag that maximises |correlation|).

Lead-lag intuition
------------------
x[t] = number of events on calendar day t (event intensity).
y[t] = mean 1-bar forward return for events on calendar day t.
For lag L: does high event density on day t predict high return L trading
days later?  Compute Pearson(x[0..n-L-1], y[L..n-1]) for each L.

Invariants
----------
- All data injected; no DB reads, no clock reads.
- Constant series → correlation undefined → stored as 0.0 (documented).
- Series with fewer than 2 pairs at a given lag → 0.0.
- Empty inputs → every lag maps to 0.0.

Side effects: none.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from datetime import date

__all__ = [
    "lagged_cross_correlation",
    "optimal_lag",
    "build_aligned_series",
]


# ---------------------------------------------------------------------------
# Internal: Pearson r
# ---------------------------------------------------------------------------


def _pearson(a: list[float], b: list[float]) -> float | None:
    """Pearson r for two equal-length lists.

    Returns None when the correlation is undefined:
      - fewer than 2 data points, OR
      - either series is constant (zero std dev).

    Args:
        a: first series.
        b: second series (same length as a).

    Returns:
        Pearson r in [-1, 1], or None when undefined.
    """
    n = len(a)
    if n < 2:
        return None
    mean_a = sum(a) / n
    mean_b = sum(b) / n
    da = [v - mean_a for v in a]
    db = [v - mean_b for v in b]
    num = sum(x * y for x, y in zip(da, db))
    denom_a = math.sqrt(sum(x * x for x in da))
    denom_b = math.sqrt(sum(x * x for x in db))
    if denom_a == 0.0 or denom_b == 0.0:
        # WHY: a constant predictor or response carries no signal; storing 0.0
        # rather than NaN keeps the caller's dict uniform (no None-handling).
        return None
    return num / (denom_a * denom_b)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def lagged_cross_correlation(
    x: list[float],
    y: list[float],
    lags: Iterable[int],
) -> dict[int, float]:
    """Pearson correlation of x[t] vs y[t+lag] for each candidate lag.

    Positive lag L: uses pairs (x[0..n-L-1], y[L..n-1]), i.e. y "follows"
    x by L steps. Lag 0 is the contemporaneous correlation of the full series.

    Undefined correlation (constant series, or fewer than 2 pairs at a given
    lag) is stored as 0.0 so the caller's dict is uniform.

    Args:
        x:    event-intensity series (count of events per day), length n.
        y:    forward-return series (mean 1-bar return per day), length n.
              Both series must be pre-aligned (same index = same calendar day).
        lags: candidate lag values (non-negative integers).

    Returns:
        {lag: pearson_r} — undefined values stored as 0.0.
    """
    n = min(len(x), len(y))
    result: dict[int, float] = {}
    for lag in lags:
        if lag < 0 or n - lag < 2:
            result[lag] = 0.0
            continue
        a = x[: n - lag]
        b = y[lag:n]
        r = _pearson(a, b)
        result[lag] = r if r is not None else 0.0
    return result


def optimal_lag(corr_by_lag: dict[int, float]) -> tuple[int, float]:
    """Return the (lag, corr) pair with the maximum absolute correlation.

    Ties broken by smallest lag: an earlier entry signal is preferred when
    two lags carry equal predictive power.

    Args:
        corr_by_lag: output of :func:`lagged_cross_correlation`.

    Returns:
        (lag, pearson_r) where |pearson_r| is maximised.
        (0, 0.0) when corr_by_lag is empty.
    """
    if not corr_by_lag:
        return (0, 0.0)
    # Key: (|corr| DESC, lag ASC) → negate lag to invert sort direction with max().
    return max(corr_by_lag.items(), key=lambda kv: (abs(kv[1]), -kv[0]))


def build_aligned_series(
    intensity: dict[date, int],
    mean_return: dict[date, float],
) -> tuple[list[float], list[float]]:
    """Align event-intensity and mean-return dicts into parallel float lists.

    Inner join on date: only dates present in BOTH dicts are included.
    Dates are sorted ascending so the positional index is chronological.

    Args:
        intensity:   {date: event_count} — daily event counts.
        mean_return: {date: mean_forward_return} — mean 1-bar return per date.
                     The caller must exclude dates with no usable price data
                     (i.e. only pass dates that have at least one valid return).

    Returns:
        (x, y) where:
          x = intensity values as floats, ascending by date.
          y = mean_return values, ascending by date.
        Both lists are empty when the inner join produces no common dates.
    """
    common_dates = sorted(intensity.keys() & mean_return.keys())
    x = [float(intensity[d]) for d in common_dates]
    y = [mean_return[d] for d in common_dates]
    return x, y
