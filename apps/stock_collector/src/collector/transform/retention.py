"""Pure: calendar-year retention policy for market_history pruning.

Purpose: compute the cutoff date (floor to Jan 1) and enumerate complete
calendar years eligible for deletion from Postgres, given a configurable
retention window in years.

Invariants:
  - prune_cutoff always returns Jan 1 of (today.year - years); bars strictly
    BEFORE this date are prunable (complete years only).
  - prunable_years returns only COMPLETE past years: [min_bar_year .. cutoff.year-1].
  - Both functions are pure (no IO, no clock reads, no mutation).

Side effects: none.
"""

from __future__ import annotations

from datetime import date

__all__ = ["prune_cutoff", "prunable_years"]


def prune_cutoff(today: date, years: int) -> date:
    """Calendar-year floor: ``date(today.year - years, 1, 1)``.

    Bars strictly before the returned date are prunable (i.e. they belong to
    complete calendar years older than ``years`` ago). Using Jan 1 as the floor
    ensures we never prune a partially-complete year.

    Args:
        today: reference date (read ONCE at the IO boundary, passed in).
        years: retention window in years (positive integer).

    Returns:
        First day of the year that is ``years`` years before ``today.year``.
    """
    return date(today.year - years, 1, 1)


def prunable_years(min_bar_year: int, cutoff: date) -> list[int]:
    """Sorted list of complete calendar years strictly below the cutoff year.

    A year is prunable only when it is a complete past year (strictly less than
    cutoff.year) AND at or after the oldest bar in the DB (min_bar_year).

    Args:
        min_bar_year: earliest calendar year of any bar for this label (from
            MIN(bar_time)::date).year in the DB query).
        cutoff: result of prune_cutoff(); only years < cutoff.year qualify.

    Returns:
        Ascending list of integers in [min_bar_year, cutoff.year - 1].
        Empty list when min_bar_year >= cutoff.year (nothing to prune).
    """
    if min_bar_year >= cutoff.year:
        return []
    return list(range(min_bar_year, cutoff.year))
