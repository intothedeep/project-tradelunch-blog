"""Spec: L17 — db_keep_cutoff pure helper + DB-window gate routing logic.

Tests:
  - db_keep_cutoff: correct boundary for various keep_quarters values
  - Gate routing: given a span of periods 2013..now, correct split between
    DB-window and archive-only buckets
  - Edge cases: keep_quarters=0, keep_quarters not divisible by 4

No network, no DB, no filesystem IO — pure functions only.
"""

from __future__ import annotations

from datetime import date

import pytest

from collector.transform.retention import db_keep_cutoff


# ---------------------------------------------------------------------------
# db_keep_cutoff — boundary correctness
# ---------------------------------------------------------------------------


class TestDbKeepCutoff:
    def test_12_quarters_is_3_years(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 12) == date(2023, 1, 1)

    def test_8_quarters_is_2_years(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 8) == date(2024, 1, 1)

    def test_4_quarters_is_1_year(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 4) == date(2025, 1, 1)

    def test_16_quarters_is_4_years(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 16) == date(2022, 1, 1)

    def test_boundary_is_always_jan1(self):
        # Regardless of today's month/day, result is always Jan 1.
        for month in (1, 6, 12):
            today = date(2026, month, 15)
            result = db_keep_cutoff(today, 12)
            assert result.month == 1
            assert result.day == 1

    def test_today_year_drives_result(self):
        # Changing today year shifts the cutoff by the same delta.
        assert db_keep_cutoff(date(2025, 6, 30), 12) == date(2022, 1, 1)
        assert db_keep_cutoff(date(2027, 6, 30), 12) == date(2024, 1, 1)

    def test_odd_quarters_floor_divides(self):
        # 13 quarters // 4 = 3 years back
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 13) == date(2023, 1, 1)

    def test_5_quarters_floor_divides_to_1_year(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 5) == date(2025, 1, 1)

    def test_zero_quarters_is_current_year(self):
        today = date(2026, 6, 30)
        assert db_keep_cutoff(today, 0) == date(2026, 1, 1)


# ---------------------------------------------------------------------------
# Gate routing: which periods go to DB vs archive-only
# ---------------------------------------------------------------------------


def _route_periods(
    periods: list[date],
    today: date,
    keep_quarters: int,
) -> tuple[list[date], list[date]]:
    """Pure gate: returns (db_periods, archive_only_periods).

    Mirrors the gate logic in run_backfill._run_live:
        in_db_window = period >= cutoff
    """
    cutoff = db_keep_cutoff(today, keep_quarters)
    db_periods = [p for p in periods if p >= cutoff]
    archive_only = [p for p in periods if p < cutoff]
    return db_periods, archive_only


class TestGateRouting:
    def _periods_2013_to_2026(self) -> list[date]:
        """54 quarterly periods from 2013-Q1 to 2026-Q2 (inclusive)."""
        quarters = [(3, 31), (6, 30), (9, 30), (12, 31)]
        periods = []
        for year in range(2013, 2027):
            for month, day in quarters:
                if year == 2026 and month > 6:
                    break
                periods.append(date(year, month, day))
        return periods

    def test_all_periods_go_to_archive(self):
        """Parquet receives every period regardless of the DB gate."""
        periods = self._periods_2013_to_2026()
        today = date(2026, 6, 30)
        db_p, archive_only = _route_periods(periods, today, keep_quarters=12)
        # Union of both sets must equal the full period list.
        assert sorted(db_p + archive_only) == sorted(periods)

    def test_db_periods_are_within_keep_window(self):
        today = date(2026, 6, 30)
        cutoff = db_keep_cutoff(today, 12)  # 2023-01-01
        periods = self._periods_2013_to_2026()
        db_p, _ = _route_periods(periods, today, 12)
        assert all(p >= cutoff for p in db_p)

    def test_archive_only_periods_are_older_than_cutoff(self):
        today = date(2026, 6, 30)
        cutoff = db_keep_cutoff(today, 12)
        periods = self._periods_2013_to_2026()
        _, archive_only = _route_periods(periods, today, 12)
        assert all(p < cutoff for p in archive_only)

    def test_12q_cutoff_routes_2013_to_archive_only(self):
        today = date(2026, 6, 30)
        # cutoff = 2023-01-01; periods from 2013 are all archive-only
        periods_2013 = [date(2013, m, d) for m, d in [(3, 31), (6, 30), (9, 30), (12, 31)]]
        _, archive_only = _route_periods(periods_2013, today, 12)
        assert archive_only == periods_2013

    def test_recent_periods_go_to_db(self):
        today = date(2026, 6, 30)
        # 2025 periods are within 12q window (cutoff=2023-01-01)
        periods_2025 = [date(2025, m, d) for m, d in [(3, 31), (6, 30), (9, 30), (12, 31)]]
        db_p, archive_only = _route_periods(periods_2025, today, 12)
        assert db_p == periods_2025
        assert archive_only == []

    def test_boundary_period_goes_to_db(self):
        # Period exactly on cutoff date goes to DB (>= cutoff).
        today = date(2026, 6, 30)
        cutoff = db_keep_cutoff(today, 12)  # 2023-01-01
        # Nearest quarterly period at or after 2023-01-01 is 2023-03-31
        boundary = date(2023, 3, 31)
        db_p, _ = _route_periods([boundary], today, 12)
        assert boundary in db_p

    def test_full_2013_run_counts(self):
        """Sanity: 54 total periods; most are archive-only with 12q window."""
        today = date(2026, 6, 30)
        periods = self._periods_2013_to_2026()
        db_p, archive_only = _route_periods(periods, today, 12)
        # Total must equal full list
        assert len(db_p) + len(archive_only) == len(periods)
        # Majority from 2013..2022 are archive-only (40 quarters)
        assert len(archive_only) > len(db_p)

    def test_keep_quarters_0_all_go_to_archive(self):
        # cutoff = current year Jan 1; all past periods are archive-only
        today = date(2026, 6, 30)
        periods = [date(2025, 12, 31), date(2024, 9, 30)]
        db_p, archive_only = _route_periods(periods, today, 0)
        # cutoff = 2026-01-01; 2025 and 2024 are before cutoff
        assert db_p == []
        assert sorted(archive_only) == sorted(periods)

    def test_sets_are_disjoint(self):
        today = date(2026, 6, 30)
        periods = self._periods_2013_to_2026()
        db_p, archive_only = _route_periods(periods, today, 12)
        assert set(db_p).isdisjoint(set(archive_only))
