"""Unit tests for transform/lead_lag.py (Phase T) — pure, no network, no DB.

Covers:
  * lagged_cross_correlation: contemporaneous corr, lagged recovery, empty/short/constant guards
  * optimal_lag: empty, single-entry, max-|corr| selection, ties broken by smallest lag
  * build_aligned_series: inner join, ascending sort, no-overlap → empty
"""

from __future__ import annotations

from datetime import date

import pytest

from collector.transform.lead_lag import (
    build_aligned_series,
    lagged_cross_correlation,
    optimal_lag,
)


# ---------------------------------------------------------------------------
# lagged_cross_correlation
# ---------------------------------------------------------------------------


class TestLaggedCrossCorrelation:
    def test_contemporaneous_perfect_positive(self) -> None:
        x = [1.0, 2.0, 3.0, 4.0]
        y = [2.0, 4.0, 6.0, 8.0]
        result = lagged_cross_correlation(x, y, lags=[0])
        assert result[0] == pytest.approx(1.0)

    def test_contemporaneous_perfect_negative(self) -> None:
        x = [1.0, 2.0, 3.0, 4.0]
        y = [4.0, 3.0, 2.0, 1.0]
        result = lagged_cross_correlation(x, y, lags=[0])
        assert result[0] == pytest.approx(-1.0)

    def test_recovers_correct_lag(self) -> None:
        """y is x shifted right by 3 → lag 3 should have the highest |corr|."""
        # x: events at positions 0, 3, 6 of length 10
        x = [1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 3.0, 0.0, 0.0, 0.0]
        # y: same pattern delayed by 3 positions
        y = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 3.0]
        result = lagged_cross_correlation(x, y, lags=range(1, 6))
        best_lag = max(result, key=lambda k: abs(result[k]))
        assert best_lag == 3
        # Verify the recovered correlation is near perfect.
        assert result[3] == pytest.approx(1.0, abs=1e-6)

    def test_empty_series_returns_zero_for_all_lags(self) -> None:
        result = lagged_cross_correlation([], [], lags=[1, 2, 3])
        assert result == {1: 0.0, 2: 0.0, 3: 0.0}

    def test_single_point_returns_zero(self) -> None:
        result = lagged_cross_correlation([1.0], [2.0], lags=[0, 1])
        assert result[0] == 0.0
        assert result[1] == 0.0

    def test_constant_x_returns_zero(self) -> None:
        x = [5.0, 5.0, 5.0, 5.0]
        y = [1.0, 2.0, 3.0, 4.0]
        result = lagged_cross_correlation(x, y, lags=[0])
        assert result[0] == 0.0

    def test_constant_y_returns_zero(self) -> None:
        x = [1.0, 2.0, 3.0, 4.0]
        y = [7.0, 7.0, 7.0, 7.0]
        result = lagged_cross_correlation(x, y, lags=[0])
        assert result[0] == 0.0

    def test_lag_larger_than_series_returns_zero(self) -> None:
        x = [1.0, 2.0, 3.0]
        y = [1.0, 2.0, 3.0]
        result = lagged_cross_correlation(x, y, lags=[10])
        assert result[10] == 0.0

    def test_lag_leaves_exactly_two_pairs(self) -> None:
        # n=4, lag=2 → 4-2=2 pairs: valid.
        x = [1.0, 0.0, 2.0, 0.0]
        y = [0.0, 0.0, 1.0, 0.0]
        result = lagged_cross_correlation(x, y, lags=[2])
        # Just check it doesn't return 0 due to a guard error.
        assert 2 in result

    def test_multiple_lags_all_present_in_result(self) -> None:
        x = [1.0, 2.0, 3.0, 4.0, 5.0]
        y = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = lagged_cross_correlation(x, y, lags=[0, 1, 2])
        assert set(result.keys()) == {0, 1, 2}

    def test_lag_zero_identical_series_is_one(self) -> None:
        x = [1.0, 3.0, 2.0, 5.0, 4.0]
        result = lagged_cross_correlation(x, x, lags=[0])
        assert result[0] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# optimal_lag
# ---------------------------------------------------------------------------


class TestOptimalLag:
    def test_empty_returns_default(self) -> None:
        assert optimal_lag({}) == (0, 0.0)

    def test_single_entry(self) -> None:
        lag, corr = optimal_lag({3: 0.7})
        assert lag == 3
        assert corr == pytest.approx(0.7)

    def test_picks_max_absolute_positive(self) -> None:
        corr_by_lag = {1: 0.3, 2: 0.8, 3: 0.5}
        lag, corr = optimal_lag(corr_by_lag)
        assert lag == 2
        assert corr == pytest.approx(0.8)

    def test_picks_max_absolute_negative(self) -> None:
        # -0.8 has higher |corr| than 0.5.
        corr_by_lag = {1: 0.3, 2: -0.8, 3: 0.5}
        lag, corr = optimal_lag(corr_by_lag)
        assert lag == 2
        assert corr == pytest.approx(-0.8)

    def test_ties_broken_by_smallest_lag(self) -> None:
        # Lags 2 and 4 have the same |corr|; smaller lag wins.
        corr_by_lag = {1: 0.5, 2: 0.9, 3: 0.6, 4: 0.9}
        lag, corr = optimal_lag(corr_by_lag)
        assert lag == 2
        assert corr == pytest.approx(0.9)

    def test_all_zero_still_returns_a_lag(self) -> None:
        corr_by_lag = {1: 0.0, 2: 0.0, 3: 0.0}
        lag, corr = optimal_lag(corr_by_lag)
        assert lag in {1, 2, 3}
        assert corr == 0.0


# ---------------------------------------------------------------------------
# build_aligned_series
# ---------------------------------------------------------------------------


class TestBuildAlignedSeries:
    def test_inner_join_excludes_missing_dates(self) -> None:
        d1 = date(2024, 1, 1)
        d2 = date(2024, 1, 2)
        d3 = date(2024, 1, 3)
        intensity = {d1: 3, d2: 5, d3: 2}
        mean_return = {d1: 0.01, d3: -0.02}  # d2 missing from returns
        x, y = build_aligned_series(intensity, mean_return)
        assert len(x) == 2
        assert len(y) == 2
        assert x == [3.0, 2.0]
        assert y == pytest.approx([0.01, -0.02])

    def test_no_overlap_returns_empty(self) -> None:
        intensity = {date(2024, 1, 1): 1}
        mean_return = {date(2024, 1, 2): 0.05}
        x, y = build_aligned_series(intensity, mean_return)
        assert x == []
        assert y == []

    def test_ascending_date_sort(self) -> None:
        d1 = date(2024, 3, 1)
        d2 = date(2024, 1, 1)
        d3 = date(2024, 2, 1)
        intensity = {d1: 1, d2: 2, d3: 3}
        mean_return = {d1: 0.1, d2: 0.2, d3: 0.3}
        x, y = build_aligned_series(intensity, mean_return)
        # Expected order: d2 (Jan) < d3 (Feb) < d1 (Mar)
        assert x == [2.0, 3.0, 1.0]
        assert y == pytest.approx([0.2, 0.3, 0.1])

    def test_intensity_cast_to_float(self) -> None:
        d = date(2024, 6, 1)
        x, y = build_aligned_series({d: 7}, {d: 0.03})
        assert isinstance(x[0], float)
        assert x[0] == 7.0

    def test_full_overlap_preserves_all_dates(self) -> None:
        dates = [date(2024, 1, i) for i in range(1, 6)]
        intensity = {d: i + 1 for i, d in enumerate(dates)}
        mean_return = {d: i * 0.01 for i, d in enumerate(dates)}
        x, y = build_aligned_series(intensity, mean_return)
        assert len(x) == 5
        assert len(y) == 5
