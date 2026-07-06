"""Pure: calendar-year retention policy for market_history pruning.

Purpose: compute the cutoff date (floor to Jan 1) and enumerate complete
calendar years eligible for deletion from Postgres, given a configurable
retention window in years.

Also provides 13F-specific quarter-count cutoff logic (L18):
  * holdings_prune_periods: given all distinct periods for a CIK, return those
    older than keep_quarters most-recent distinct quarters.

Also provides a day-based TTL cutoff (Phase N):
  * age_cutoff: ``now - days`` for the log-retention prune (error_log, batch_log).

Also provides DB-window gate for backfill decoupling (L17):
  * db_keep_cutoff: earliest period_of_report to allow into Postgres during a
    backfill run; periods older than this skip DB writes but still go to Parquet.

Also provides the backtest universe retention exemption (XE.6):
  * BACKTEST_RETAIN_LABELS: frozenset of market_history labels that must NEVER
    be pruned; the /backtest feature relies on their full deep history.

Invariants:
  - prune_cutoff always returns Jan 1 of (today.year - years); bars strictly
    BEFORE this date are prunable (complete years only).
  - prunable_years returns only COMPLETE past years: [min_bar_year .. cutoff.year-1].
  - holdings_prune_periods returns periods (dates) sorted ascending; newest
    keep_quarters periods are retained, remainder are prune candidates.
  - age_cutoff returns now - days; rows with created_at strictly BEFORE it are
    prunable.
  - db_keep_cutoff returns Jan 1 of the year (today.year - keep_quarters // 4);
    periods >= this date are written to DB; older periods are archive-only.
  - All functions are pure (no IO, no clock reads, no mutation).

Side effects: none.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

__all__ = [
    "BACKTEST_RETAIN_LABELS",
    "prune_cutoff",
    "prunable_years",
    "holdings_prune_periods",
    "age_cutoff",
    "db_keep_cutoff",
]

# WHY: the /backtest feature deep-backfilled these labels to inception
# (QQQ 1999, SPY 1993, ^IXIC 1971). The Max preset and long-range backtests
# depend on the full history. Pruning pre-2021 bars would silently break
# that feature. These labels are PERMANENTLY exempt from the rolling hot-window
# prune. Failure mode of this exemption is "keeps too much data" (safe),
# never "deletes something it shouldn't". (#XE.6)
BACKTEST_RETAIN_LABELS: frozenset[str] = frozenset({
    "QQQ",
    "QQQM",
    "QLD",
    "TQQQ",
    "SPY",
    "SCHD",
    "JEPQ",
    "VOO",
    "VOOG",
    "NASDAQ Composite",
    "NASDAQ 100",
})


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


def age_cutoff(now: datetime, days: int) -> datetime:
    """Day-based TTL floor: ``now - days``.

    Rows whose timestamp is strictly BEFORE the returned instant are prunable.
    Used by the log-retention prune (error_log, batch_log) where retention is a
    rolling age window rather than complete calendar years.

    Args:
        now: reference instant (read ONCE at the IO boundary, passed in). Should
            be tz-aware UTC so the comparison matches TIMESTAMPTZ columns.
        days: retention window in days (positive integer).

    Returns:
        ``now - days`` as a datetime (same tzinfo as ``now``).

    Pure — no IO, no clock read.
    """
    return now - timedelta(days=days)


def db_keep_cutoff(today: date, keep_quarters: int) -> date:
    """Earliest period_of_report that should be written to Postgres in a backfill.

    Converts a quarter-count window to a calendar-year floor using integer
    division (4 quarters per year). Periods >= the returned date are written to
    DB; periods strictly before it are archive-only (Parquet cold store).

    The floor is Jan 1 so the boundary is always aligned to a quarter-start
    and never splits a calendar year mid-way.

    Examples:
        keep_quarters=12 (3 years), today=2026-06-30 -> date(2023, 1, 1)
        keep_quarters=8  (2 years), today=2026-06-30 -> date(2024, 1, 1)
        keep_quarters=4  (1 year),  today=2026-06-30 -> date(2025, 1, 1)

    Args:
        today: reference date (read ONCE at the IO boundary, passed in).
        keep_quarters: number of quarters to retain in DB (must be >= 1).

    Returns:
        date(today.year - keep_quarters // 4, 1, 1)

    Pure — no IO, no clock read.
    """
    years_back = keep_quarters // 4
    return date(today.year - years_back, 1, 1)
