"""Pure: calendar-year retention policy for market_history pruning.

Purpose: compute the cutoff date (floor to Jan 1) and enumerate complete
calendar years eligible for deletion from Postgres, given a configurable
retention window in years.

Also provides 13F-specific quarter-count cutoff logic (L18):
  * holdings_prune_periods: given all distinct periods for a CIK, return those
    older than keep_quarters most-recent distinct quarters.

Invariants:
  - prune_cutoff always returns Jan 1 of (today.year - years); bars strictly
    BEFORE this date are prunable (complete years only).
  - prunable_years returns only COMPLETE past years: [min_bar_year .. cutoff.year-1].
  - holdings_prune_periods returns periods (dates) sorted ascending; newest
    keep_quarters periods are retained, remainder are prune candidates.
  - All functions are pure (no IO, no clock reads, no mutation).

Side effects: none.
"""

from __future__ import annotations

from datetime import date

__all__ = ["prune_cutoff", "prunable_years", "holdings_prune_periods"]


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


def holdings_prune_periods(
    all_periods: list[date],
    keep_quarters: int,
) -> list[date]:
    """Return the 13F period_of_report dates that are OLDER than the newest
    keep_quarters distinct periods (i.e. the prune candidates).

    The newest keep_quarters periods are retained; all older ones are candidates
    for hard-delete (subject to archive precondition in the caller).

    Args:
        all_periods: list of distinct period_of_report dates for one CIK
            (order does not matter; duplicates are de-duped internally).
        keep_quarters: number of most-recent distinct quarters to retain
            (default in prune_holdings is 12, i.e. 3 years).

    Returns:
        Ascending list of period dates older than the retention window.
        Empty when len(distinct periods) <= keep_quarters.

    Pure — no IO.
    """
    distinct = sorted(set(all_periods))
    if len(distinct) <= keep_quarters:
        return []
    return distinct[: len(distinct) - keep_quarters]
