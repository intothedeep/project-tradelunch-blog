"""Spec: collector.transform.retention — prune_cutoff + prunable_years."""

from datetime import date

from collector.transform.retention import prune_cutoff, prunable_years


# --- prune_cutoff -----------------------------------------------------------

def test_cutoff_is_jan1_of_year_minus_years():
    today = date(2026, 6, 30)
    assert prune_cutoff(today, 5) == date(2021, 1, 1)


def test_cutoff_one_year():
    today = date(2026, 1, 15)
    assert prune_cutoff(today, 1) == date(2025, 1, 1)


def test_cutoff_uses_today_year_not_doy():
    # Day-of-year must not affect the cutoff — only the year matters.
    assert prune_cutoff(date(2026, 12, 31), 5) == prune_cutoff(date(2026, 1, 1), 5)


# --- prunable_years ---------------------------------------------------------

def test_prunable_years_returns_sorted_range():
    cutoff = date(2026, 1, 1)
    result = prunable_years(2020, cutoff)
    assert result == [2020, 2021, 2022, 2023, 2024, 2025]


def test_prunable_years_empty_when_min_equals_cutoff_year():
    cutoff = date(2026, 1, 1)
    assert prunable_years(2026, cutoff) == []


def test_prunable_years_empty_when_min_above_cutoff_year():
    cutoff = date(2026, 1, 1)
    assert prunable_years(2027, cutoff) == []


def test_prunable_years_single_year():
    cutoff = date(2026, 1, 1)
    result = prunable_years(2025, cutoff)
    assert result == [2025]


def test_prunable_years_excludes_cutoff_year_itself():
    cutoff = date(2026, 6, 30)  # mid-year cutoff — year is still 2026
    result = prunable_years(2020, cutoff)
    # 2026 is NOT included — it's the cutoff year (not a complete past year)
    assert 2026 not in result
    assert result[-1] == 2025


def test_prunable_years_is_ascending():
    cutoff = date(2026, 1, 1)
    result = prunable_years(2018, cutoff)
    assert result == sorted(result)
