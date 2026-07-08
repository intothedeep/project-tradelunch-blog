"""Unit tests for transform/event_study.py — pure, no network, no DB.

Covers:
  * event_window_start: returns event_date + 1 day
  * look-ahead gate: entry is NEVER same-day bar
  * cumulative_abnormal_return: correct return for each horizon
  * horizon slicing: horizon h uses bars[0] and bars[h] (not bars[h-1])
  * insufficient bars → None for that horizon
  * benchmark subtraction (abnormal return)
  * benchmark insufficient → None for that horizon
  * directional_hit: buy/sell correctness, boundary (car==0.0 → False)
  * directional_hit: unknown direction raises ValueError
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from collector.transform.event_study import (
    cumulative_abnormal_return,
    directional_hit,
    event_window_start,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BASE = date(2024, 1, 10)  # a Wednesday (non-weekend)


def _series(start: date, prices: list[float]) -> list[tuple[date, float]]:
    """Build ascending (date, price) pairs starting from ``start``."""
    return [(start + timedelta(days=i), p) for i, p in enumerate(prices)]


# ---------------------------------------------------------------------------
# event_window_start
# ---------------------------------------------------------------------------


class TestEventWindowStart:
    def test_returns_next_day(self) -> None:
        result = event_window_start(_BASE)
        assert result == _BASE + timedelta(days=1)

    def test_never_same_day(self) -> None:
        gate = event_window_start(_BASE)
        assert gate > _BASE

    def test_end_of_year(self) -> None:
        eoy = date(2023, 12, 31)
        assert event_window_start(eoy) == date(2024, 1, 1)


# ---------------------------------------------------------------------------
# cumulative_abnormal_return — entry alignment
# ---------------------------------------------------------------------------


class TestEntryAlignment:
    def test_same_day_bar_excluded(self) -> None:
        """A bar on event_date itself must NOT be used as entry."""
        # event_date = _BASE; series starts on _BASE (same day)
        # entry must be the bar on _BASE + 1
        prices = [100.0, 110.0, 120.0]   # bar_dates: _BASE, _BASE+1, _BASE+2
        series = _series(_BASE, prices)
        result = cumulative_abnormal_return(_BASE, series, horizons=(1,))
        # entry = 110.0 (bar at _BASE+1), exit = 120.0 (bar at _BASE+2)
        expected = (120.0 - 110.0) / 110.0
        assert result[1] == pytest.approx(expected)

    def test_entry_is_first_bar_after_gate(self) -> None:
        # series has gap: bars at _BASE-1 and _BASE+2 only
        series = [(_BASE - timedelta(days=1), 50.0), (_BASE + timedelta(days=2), 100.0),
                  (_BASE + timedelta(days=3), 110.0)]
        result = cumulative_abnormal_return(_BASE, series, horizons=(1,))
        # entry = 100.0 (first bar after _BASE), exit = 110.0
        expected = (110.0 - 100.0) / 100.0
        assert result[1] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# cumulative_abnormal_return — horizon correctness
# ---------------------------------------------------------------------------


class TestHorizonSlicing:
    def _make_series(self) -> list[tuple[date, float]]:
        # 25 bars after event_date: prices 100, 102, 104, ..., 148
        return _series(_BASE + timedelta(days=1), [100.0 + 2 * i for i in range(25)])

    def test_horizon_1(self) -> None:
        series = self._make_series()
        result = cumulative_abnormal_return(_BASE, series, horizons=(1,))
        # entry=100, exit=102 (bars[0] and bars[1])
        assert result[1] == pytest.approx((102.0 - 100.0) / 100.0)

    def test_horizon_5(self) -> None:
        series = self._make_series()
        result = cumulative_abnormal_return(_BASE, series, horizons=(5,))
        # entry=100, exit=110 (bars[0] and bars[5])
        assert result[5] == pytest.approx((110.0 - 100.0) / 100.0)

    def test_horizon_21(self) -> None:
        series = self._make_series()
        result = cumulative_abnormal_return(_BASE, series, horizons=(21,))
        # entry=100, exit=142 (bars[0] and bars[21])
        assert result[21] == pytest.approx((142.0 - 100.0) / 100.0)

    def test_multiple_horizons(self) -> None:
        series = self._make_series()
        result = cumulative_abnormal_return(_BASE, series)
        assert 1 in result
        assert 5 in result
        assert 21 in result


# ---------------------------------------------------------------------------
# cumulative_abnormal_return — insufficient bars
# ---------------------------------------------------------------------------


class TestInsufficientBars:
    def test_no_entry_bar(self) -> None:
        # All bars on or before event_date → empty entry window
        series = [(_BASE - timedelta(days=1), 100.0)]
        result = cumulative_abnormal_return(_BASE, series, horizons=(1, 5, 21))
        assert all(v is None for v in result.values())

    def test_only_entry_bar(self) -> None:
        # 1 bar after event_date: horizon 1 needs 2 bars (entry + exit)
        series = [(_BASE + timedelta(days=1), 100.0)]
        result = cumulative_abnormal_return(_BASE, series, horizons=(1,))
        assert result[1] is None

    def test_partial_coverage(self) -> None:
        # 6 bars: horizon 1 and 5 OK; horizon 21 None
        series = _series(_BASE + timedelta(days=1), [100.0 + i for i in range(6)])
        result = cumulative_abnormal_return(_BASE, series, horizons=(1, 5, 21))
        assert result[1] is not None
        assert result[5] is not None
        assert result[21] is None

    def test_zero_entry_price_returns_none(self) -> None:
        series = _series(_BASE + timedelta(days=1), [0.0, 10.0, 20.0])
        result = cumulative_abnormal_return(_BASE, series, horizons=(1,))
        assert result[1] is None


# ---------------------------------------------------------------------------
# cumulative_abnormal_return — abnormal (benchmark subtraction)
# ---------------------------------------------------------------------------


class TestAbnormalReturn:
    def test_subtract_benchmark(self) -> None:
        stock = _series(_BASE + timedelta(days=1), [100.0, 110.0, 121.0])   # +10%, +10%
        bench = _series(_BASE + timedelta(days=1), [200.0, 204.0, 208.0])   # +2%, +4%
        result = cumulative_abnormal_return(_BASE, stock, horizons=(1,), benchmark_series=bench)
        stock_ret = (110.0 - 100.0) / 100.0   # 0.10
        bench_ret = (204.0 - 200.0) / 200.0   # 0.02
        assert result[1] == pytest.approx(stock_ret - bench_ret)

    def test_benchmark_insufficient_gives_none(self) -> None:
        # stock has 22 bars, benchmark has only 2 bars (covers horizon 1 but not 21)
        stock = _series(_BASE + timedelta(days=1), [100.0 + i for i in range(23)])
        bench = _series(_BASE + timedelta(days=1), [200.0, 202.0])
        result = cumulative_abnormal_return(_BASE, stock, horizons=(1, 21), benchmark_series=bench)
        # horizon 1: bench covers entry..entry+1 → should work
        assert result[1] is not None
        # horizon 21: bench only covers 2 bars → None
        assert result[21] is None

    def test_none_benchmark_gives_raw_return(self) -> None:
        stock = _series(_BASE + timedelta(days=1), [100.0, 105.0])
        result = cumulative_abnormal_return(_BASE, stock, horizons=(1,), benchmark_series=None)
        assert result[1] == pytest.approx(0.05)


# ---------------------------------------------------------------------------
# directional_hit
# ---------------------------------------------------------------------------


class TestDirectionalHit:
    def test_buy_positive_car_is_hit(self) -> None:
        assert directional_hit(0.05, "buy") is True

    def test_buy_negative_car_is_miss(self) -> None:
        assert directional_hit(-0.02, "buy") is False

    def test_buy_zero_car_is_miss(self) -> None:
        assert directional_hit(0.0, "buy") is False

    def test_sell_negative_car_is_hit(self) -> None:
        assert directional_hit(-0.03, "sell") is True

    def test_sell_positive_car_is_miss(self) -> None:
        assert directional_hit(0.01, "sell") is False

    def test_sell_zero_car_is_miss(self) -> None:
        assert directional_hit(0.0, "sell") is False

    def test_unknown_direction_raises(self) -> None:
        with pytest.raises(ValueError, match="unknown direction"):
            directional_hit(0.05, "hold")
