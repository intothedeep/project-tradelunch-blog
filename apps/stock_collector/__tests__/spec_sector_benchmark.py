"""Unit tests for transform/sector_benchmark.py — pure, no network, no DB.

Covers:
  * empty sector → []
  * single member → index equals its own normalised return series
  * cap-weight math: heavier cap dominates the index
  * date alignment: output sorted ascending, gate filter applied
  * null / zero shares excluded
  * gapped dates: members with different trading days union correctly
  * output compatible with cumulative_abnormal_return (benchmark_series shape)
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from collector.transform.sector_benchmark import SectorMember, build_sector_index


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GATE = date(2024, 1, 11)  # arbitrary gate (event_date + 1)


def _series(start: date, prices: list[float]) -> list[tuple[date, float]]:
    """Consecutive (date, price) pairs from start."""
    return [(start + timedelta(days=i), p) for i, p in enumerate(prices)]


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_empty_members(self) -> None:
        assert build_sector_index([], _GATE, 10) == []

    def test_all_zero_shares_excluded(self) -> None:
        m = SectorMember(0.0, _series(_GATE, [100.0, 105.0]))
        assert build_sector_index([m], _GATE, 10) == []

    def test_all_negative_shares_excluded(self) -> None:
        m = SectorMember(-1.0, _series(_GATE, [100.0, 105.0]))
        assert build_sector_index([m], _GATE, 10) == []

    def test_member_no_bars_after_gate(self) -> None:
        # price series entirely before gate
        prices = [(date(2024, 1, 9), 100.0), (date(2024, 1, 10), 101.0)]
        m = SectorMember(1e6, prices)
        assert build_sector_index([m], _GATE, 10) == []

    def test_member_missing_t0_price_excluded(self) -> None:
        # Two members but only one has price on t0 (the earliest date)
        # m1 starts at gate+1 (misses t0 = gate)
        m1 = SectorMember(1e9, _series(_GATE + timedelta(days=1), [200.0, 210.0]))
        m2 = SectorMember(1e6, _series(_GATE, [100.0, 105.0]))
        # t0 = gate; m1 has no price at gate so only m2 contributes
        result = build_sector_index([m1, m2], _GATE, 10)
        # With only m2 surviving, index at t0 = 1.0, at t0+1 = 105/100 = 1.05
        assert len(result) >= 2
        t0_bar = result[0]
        assert t0_bar[0] == _GATE
        assert t0_bar[1] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Single member
# ---------------------------------------------------------------------------


class TestSingleMember:
    def test_index_at_t0_is_one(self) -> None:
        m = SectorMember(1e6, _series(_GATE, [50.0, 55.0, 60.0]))
        result = build_sector_index([m], _GATE, 10)
        assert result[0][1] == pytest.approx(1.0)

    def test_index_mirrors_return(self) -> None:
        # prices: 100, 110, 120 → returns +10%, +20%
        m = SectorMember(1e6, _series(_GATE, [100.0, 110.0, 120.0]))
        result = build_sector_index([m], _GATE, 10)
        assert result[0][1] == pytest.approx(1.0)
        assert result[1][1] == pytest.approx(110.0 / 100.0)
        assert result[2][1] == pytest.approx(120.0 / 100.0)

    def test_num_bars_cap(self) -> None:
        m = SectorMember(1e6, _series(_GATE, [100.0 + i for i in range(30)]))
        result = build_sector_index([m], _GATE, 5)
        assert len(result) == 5


# ---------------------------------------------------------------------------
# Cap-weight math
# ---------------------------------------------------------------------------


class TestCapWeightMath:
    def test_equal_weight_two_members(self) -> None:
        # Both members: same shares, same t0 price → equal weight
        # m1: +10% at bar 1; m2: flat at bar 1 → index = 0.5*(1.1) + 0.5*(1.0) = 1.05
        m1 = SectorMember(1e6, _series(_GATE, [100.0, 110.0]))
        m2 = SectorMember(1e6, _series(_GATE, [100.0, 100.0]))
        result = build_sector_index([m1, m2], _GATE, 10)
        assert result[0][1] == pytest.approx(1.0)
        assert result[1][1] == pytest.approx(1.05)

    def test_larger_cap_dominates(self) -> None:
        # m1: 10× larger cap, goes up +10%; m2: tiny cap, goes down -50%
        # w1 ≈ 0.909, w2 ≈ 0.091 → index ≈ 0.909*1.10 + 0.091*0.50 ≈ 1.045
        m1 = SectorMember(1e7, _series(_GATE, [100.0, 110.0]))
        m2 = SectorMember(1e6, _series(_GATE, [100.0, 50.0]))
        result = build_sector_index([m1, m2], _GATE, 10)
        total_cap = 1e7 * 100.0 + 1e6 * 100.0
        w1 = (1e7 * 100.0) / total_cap
        w2 = (1e6 * 100.0) / total_cap
        expected = w1 * (110.0 / 100.0) + w2 * (50.0 / 100.0)
        assert result[1][1] == pytest.approx(expected)

    def test_t0_price_affects_weight(self) -> None:
        # Same shares but different t0 prices → different weights
        m1 = SectorMember(1e6, _series(_GATE, [200.0, 220.0]))  # cap 200M
        m2 = SectorMember(1e6, _series(_GATE, [100.0, 100.0]))  # cap 100M
        result = build_sector_index([m1, m2], _GATE, 10)
        # w1 = 200/(200+100) = 2/3; w2 = 1/3
        # bar1: 2/3 * (220/200) + 1/3 * (100/100) = 2/3*1.1 + 1/3 = 1.0667
        expected = (2 / 3) * (220.0 / 200.0) + (1 / 3) * (100.0 / 100.0)
        assert result[1][1] == pytest.approx(expected, rel=1e-6)


# ---------------------------------------------------------------------------
# Date alignment + gate filtering
# ---------------------------------------------------------------------------


class TestDateAlignment:
    def test_bars_before_gate_excluded(self) -> None:
        # Price series starts before gate — those bars must be filtered out
        prices = _series(_GATE - timedelta(days=2), [90.0, 95.0, 100.0, 105.0])
        m = SectorMember(1e6, prices)
        result = build_sector_index([m], _GATE, 10)
        # First output date must be >= gate
        assert result[0][0] >= _GATE

    def test_output_ascending(self) -> None:
        m = SectorMember(1e6, _series(_GATE, [100.0, 102.0, 104.0, 106.0]))
        result = build_sector_index([m], _GATE, 10)
        dates = [d for d, _ in result]
        assert dates == sorted(dates)

    def test_gapped_dates_union(self) -> None:
        # m1 has bars on days 0,2,4; m2 has bars on days 1,3 (relative to gate)
        m1_prices = [(_GATE + timedelta(days=d), 100.0 + d) for d in (0, 2, 4)]
        m2_prices = [(_GATE + timedelta(days=d), 200.0 + d) for d in (1, 3)]
        m1 = SectorMember(1e6, m1_prices)
        m2 = SectorMember(1e6, m2_prices)
        result = build_sector_index([m1, m2], _GATE, 20)
        result_dates = {d for d, _ in result}
        # t0 = gate (m1 has data); m2 has no gate price → excluded from anchoring
        # so only m1 contributes; its 3 bars appear
        assert _GATE in result_dates

    def test_both_members_share_dates_union(self) -> None:
        # Both members trade every day — union == same set, no duplication
        m1 = SectorMember(1e6, _series(_GATE, [100.0, 101.0, 102.0]))
        m2 = SectorMember(2e6, _series(_GATE, [200.0, 202.0, 204.0]))
        result = build_sector_index([m1, m2], _GATE, 10)
        dates = [d for d, _ in result]
        assert len(dates) == len(set(dates)), "no duplicate dates"
        assert len(dates) == 3


# ---------------------------------------------------------------------------
# Renormalisation for missing data
# ---------------------------------------------------------------------------


class TestRenormalisation:
    def test_missing_member_on_later_date_renormalises(self) -> None:
        # m1: 3 bars; m2: only t0 bar (no subsequent prices)
        # After t0, only m1 contributes → index = m1's return (renorm to 1 weight)
        m1 = SectorMember(1e6, _series(_GATE, [100.0, 110.0, 120.0]))
        m2 = SectorMember(1e6, [(_GATE, 100.0)])  # only t0
        result = build_sector_index([m1, m2], _GATE, 10)
        # t0: both present → idx = 1.0
        assert result[0][1] == pytest.approx(1.0)
        # bar 1: only m1 present; renorm → idx = 110/100 = 1.1
        bar1 = next(v for d, v in result if d == _GATE + timedelta(days=1))
        assert bar1 == pytest.approx(1.1)


# ---------------------------------------------------------------------------
# Shape compatibility with cumulative_abnormal_return
# ---------------------------------------------------------------------------


class TestShapeCompatibility:
    def test_output_is_list_of_date_float_tuples(self) -> None:
        m = SectorMember(1e6, _series(_GATE, [100.0, 105.0, 110.0]))
        result = build_sector_index([m], _GATE, 10)
        for item in result:
            assert len(item) == 2
            d, v = item
            assert isinstance(d, date)
            assert isinstance(v, float)

    def test_integrates_with_event_study_car(self) -> None:
        """Build a sector index and pass it to cumulative_abnormal_return."""
        from collector.transform.event_study import cumulative_abnormal_return

        event_date = _GATE - timedelta(days=1)  # gate = _GATE
        stock = _series(_GATE, [100.0, 120.0, 140.0])  # +20%, +40%
        m = SectorMember(1e6, _series(_GATE, [100.0, 110.0, 121.0]))  # +10%, +21%
        benchmark = build_sector_index([m], _GATE, 10)

        cars = cumulative_abnormal_return(
            event_date, stock, horizons=(1, 2), benchmark_series=benchmark
        )
        # horizon 1: stock +20%, sector +10% → abnormal +10%
        assert cars[1] == pytest.approx(0.10, rel=1e-6)
        # horizon 2: stock +40%, sector +21% → abnormal +19%
        assert cars[2] == pytest.approx(0.19, rel=1e-6)
