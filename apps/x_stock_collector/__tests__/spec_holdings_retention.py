"""Spec: 13F-specific retention helpers (L18 + L19) — pure functions only.

Tests:
  - retention.holdings_prune_periods     (L18 cutoff logic)
  - sec_db_sink.read_latest_period       (L19 guard, mocked DB)
  - prune_holdings._parquet_object_path  (pure path builder)
  - period-advance guard logic           (pure comparison, L19)

No network, no DB, no Storage — all IO dependencies are mocked.
"""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from collector.transform.retention import holdings_prune_periods


# ---------------------------------------------------------------------------
# holdings_prune_periods — pure cutoff logic (L18)
# ---------------------------------------------------------------------------


class TestHoldingsPrunePeriods:
    def test_empty_periods_returns_empty(self):
        assert holdings_prune_periods([], keep_quarters=12) == []

    def test_fewer_than_keep_returns_empty(self):
        periods = [date(2024, 3, 31), date(2024, 6, 30)]
        assert holdings_prune_periods(periods, keep_quarters=12) == []

    def test_exactly_keep_returns_empty(self):
        periods = [date(2023, 3, 31 - 0), date(2023, 6, 30),
                   date(2023, 9, 30), date(2023, 12, 31)]
        assert holdings_prune_periods(periods, keep_quarters=4) == []

    def test_one_over_keep_returns_oldest(self):
        periods = [
            date(2021, 3, 31),
            date(2021, 6, 30),
            date(2021, 9, 30),
            date(2021, 12, 31),
            date(2022, 3, 31),
        ]
        result = holdings_prune_periods(periods, keep_quarters=4)
        assert result == [date(2021, 3, 31)]

    def test_returns_ascending_order(self):
        periods = [date(2022 + i // 4, 3 + (i % 4) * 3, 31 - ((i % 4) in (1, 2)) * 1)
                   for i in range(12)]
        # Use simple known-order list
        base = [
            date(2020, 3, 31), date(2020, 6, 30), date(2020, 9, 30), date(2020, 12, 31),
            date(2021, 3, 31), date(2021, 6, 30), date(2021, 9, 30), date(2021, 12, 31),
            date(2022, 3, 31), date(2022, 6, 30), date(2022, 9, 30), date(2022, 12, 31),
            date(2023, 3, 31),
        ]
        result = holdings_prune_periods(base, keep_quarters=12)
        assert result == [date(2020, 3, 31)]
        assert result == sorted(result)

    def test_deduplicates_periods(self):
        # Duplicates should not inflate the count; only distinct periods matter.
        periods = [date(2022, 3, 31), date(2022, 3, 31), date(2022, 6, 30)]
        # distinct = 2 periods; keep_quarters=2 -> empty
        assert holdings_prune_periods(periods, keep_quarters=2) == []

    def test_dedup_with_excess(self):
        # 3 distinct after dedup, keep_quarters=2 -> oldest 1
        periods = [
            date(2022, 3, 31), date(2022, 3, 31),  # dup
            date(2022, 6, 30),
            date(2022, 9, 30),
        ]
        result = holdings_prune_periods(periods, keep_quarters=2)
        assert result == [date(2022, 3, 31)]

    def test_unsorted_input_handled(self):
        # Function sorts internally; input order must not matter.
        unsorted = [
            date(2023, 9, 30), date(2021, 3, 31),
            date(2022, 6, 30), date(2023, 3, 31),
            date(2022, 12, 31),
        ]
        result = holdings_prune_periods(unsorted, keep_quarters=3)
        # Distinct sorted: 2021-03, 2022-06, 2022-12, 2023-03, 2023-09
        # keep last 3: 2022-12, 2023-03, 2023-09
        # prune: 2021-03, 2022-06
        assert result == [date(2021, 3, 31), date(2022, 6, 30)]

    def test_keep_quarters_zero_returns_all(self):
        # Edge: keep_quarters=0 -> ALL periods are candidates.
        periods = [date(2022, 3, 31), date(2022, 6, 30)]
        result = holdings_prune_periods(periods, keep_quarters=0)
        assert result == [date(2022, 3, 31), date(2022, 6, 30)]

    def test_default_keep_twelve(self):
        # 13 distinct periods, keep 12 -> 1 candidate (oldest)
        periods = [date(2020 + i // 4, [3, 6, 9, 12][i % 4], 31 - (i % 4 in (1, 2)))
                   for i in range(13)]
        # Build 13 real known dates
        known = [
            date(2020, 3, 31), date(2020, 6, 30), date(2020, 9, 30), date(2020, 12, 31),
            date(2021, 3, 31), date(2021, 6, 30), date(2021, 9, 30), date(2021, 12, 31),
            date(2022, 3, 31), date(2022, 6, 30), date(2022, 9, 30), date(2022, 12, 31),
            date(2023, 3, 31),
        ]
        result = holdings_prune_periods(known, keep_quarters=12)
        assert result == [date(2020, 3, 31)]


# ---------------------------------------------------------------------------
# period-advance guard pure comparison logic (L19)
# ---------------------------------------------------------------------------


class TestPeriodAdvanceGuard:
    """The guard in run_monthly is:
        if stored_period is not None and ref.period_of_report <= stored_period: SKIP
    Test the pure boolean outcome of this comparison.
    """

    def _should_skip(self, ref_period: date, stored_period: date | None) -> bool:
        """Mirror of the guard condition in run_monthly."""
        return stored_period is not None and ref_period <= stored_period

    def test_same_period_skipped(self):
        assert self._should_skip(date(2024, 9, 30), date(2024, 9, 30)) is True

    def test_older_period_skipped(self):
        assert self._should_skip(date(2024, 6, 30), date(2024, 9, 30)) is True

    def test_new_quarter_not_skipped(self):
        assert self._should_skip(date(2024, 12, 31), date(2024, 9, 30)) is False

    def test_no_stored_period_not_skipped(self):
        # First-ever run: stored_period is None -> always proceed.
        assert self._should_skip(date(2024, 9, 30), None) is False

    def test_stored_period_none_always_proceeds(self):
        # Even very old ref periods pass when stored is None.
        assert self._should_skip(date(2010, 3, 31), None) is False


# ---------------------------------------------------------------------------
# prune_holdings._parquet_object_path — pure path builder (L18)
# ---------------------------------------------------------------------------


class TestParquetObjectPath:
    def test_path_format(self):
        from collector.entrypoints.prune_holdings import _parquet_object_path
        result = _parquet_object_path("0001067983", 2022)
        assert result == "sec13f/0001067983/0001067983_2022.parquet"

    def test_path_different_cik(self):
        from collector.entrypoints.prune_holdings import _parquet_object_path
        result = _parquet_object_path("0000950123", 2023)
        assert result == "sec13f/0000950123/0000950123_2023.parquet"

    def test_path_uses_period_year(self):
        from collector.entrypoints.prune_holdings import _parquet_object_path
        # Same cik, different years produce distinct paths.
        p2021 = _parquet_object_path("0001067983", 2021)
        p2022 = _parquet_object_path("0001067983", 2022)
        assert p2021 != p2022
        assert "2021" in p2021
        assert "2022" in p2022


# ---------------------------------------------------------------------------
# read_latest_period via mocked psycopg connection (L19)
# ---------------------------------------------------------------------------


class TestReadLatestPeriod:
    def _make_conn(self, row):
        """Build a minimal psycopg mock: conn.cursor().__enter__().fetchone() -> row."""
        cur = MagicMock()
        cur.fetchone.return_value = row
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=cur)
        ctx.__exit__ = MagicMock(return_value=False)
        conn = MagicMock()
        conn.cursor.return_value = ctx
        return conn

    def test_returns_date_when_row_exists(self):
        from collector.sink.sec_db_sink import read_latest_period
        conn = self._make_conn((date(2024, 9, 30),))
        result = read_latest_period(conn, "0001067983")
        assert result == date(2024, 9, 30)

    def test_returns_none_when_no_rows(self):
        from collector.sink.sec_db_sink import read_latest_period
        conn = self._make_conn((None,))
        result = read_latest_period(conn, "0001067983")
        assert result is None

    def test_returns_none_when_fetchone_none(self):
        from collector.sink.sec_db_sink import read_latest_period
        conn = self._make_conn(None)
        result = read_latest_period(conn, "0001067983")
        assert result is None

    def test_returns_none_on_undefined_table(self):
        import psycopg
        from collector.sink.sec_db_sink import read_latest_period

        cur = MagicMock()
        cur.execute.side_effect = psycopg.errors.UndefinedTable("no table")
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=cur)
        ctx.__exit__ = MagicMock(return_value=False)
        conn = MagicMock()
        conn.cursor.return_value = ctx
        result = read_latest_period(conn, "0001067983")
        assert result is None


# ---------------------------------------------------------------------------
# read_all_periods via mocked psycopg connection (L18)
# ---------------------------------------------------------------------------


class TestReadAllPeriods:
    def _make_conn(self, rows):
        cur = MagicMock()
        cur.fetchall.return_value = rows
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=cur)
        ctx.__exit__ = MagicMock(return_value=False)
        conn = MagicMock()
        conn.cursor.return_value = ctx
        return conn

    def test_returns_dates_in_order(self):
        from collector.sink.sec_db_sink import read_all_periods
        rows = [(date(2022, 3, 31),), (date(2022, 6, 30),), (date(2022, 9, 30),)]
        conn = self._make_conn(rows)
        result = read_all_periods(conn, "0001067983")
        assert result == [date(2022, 3, 31), date(2022, 6, 30), date(2022, 9, 30)]

    def test_returns_empty_when_no_rows(self):
        from collector.sink.sec_db_sink import read_all_periods
        conn = self._make_conn([])
        result = read_all_periods(conn, "0001067983")
        assert result == []

    def test_returns_empty_on_undefined_table(self):
        import psycopg
        from collector.sink.sec_db_sink import read_all_periods

        cur = MagicMock()
        cur.execute.side_effect = psycopg.errors.UndefinedTable("no table")
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=cur)
        ctx.__exit__ = MagicMock(return_value=False)
        conn = MagicMock()
        conn.cursor.return_value = ctx
        result = read_all_periods(conn, "0001067983")
        assert result == []
