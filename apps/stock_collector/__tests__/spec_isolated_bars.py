from dataclasses import dataclass
from datetime import date

from collector.transform.detect_isolated_bars import detect_isolated_bars


@dataclass(frozen=True)
class Bar:
    label: str
    bar_time: date


REF = {f"S{i}" for i in range(10)}  # 10-symbol reference group


def _real_day(d: date) -> list[Bar]:
    return [Bar(f"S{i}", d) for i in range(10)]  # all 10 present


def test_isolated_holiday_bar_is_flagged():
    rows: list[Bar] = []
    rows += _real_day(date(2026, 1, 5))  # Mon — real
    rows += _real_day(date(2026, 1, 6))  # Tue — real
    # phantom "holiday": only S0, S1 have a bar
    rows += [Bar("S0", date(2026, 1, 7)), Bar("S1", date(2026, 1, 7))]
    rows += _real_day(date(2026, 1, 8))  # Thu — real

    suspects = detect_isolated_bars(rows, REF)
    assert suspects == [("S0", date(2026, 1, 7)), ("S1", date(2026, 1, 7))]


def test_full_consensus_day_not_flagged():
    rows = _real_day(date(2026, 1, 5)) + _real_day(date(2026, 1, 6))
    assert detect_isolated_bars(rows, REF) == []


def test_minor_data_lag_not_flagged():
    # 7/10 present (0.7 >= 0.5 ratio) — normal lag, not an isolated date.
    rows = _real_day(date(2026, 1, 5))
    rows += [Bar(f"S{i}", date(2026, 1, 6)) for i in range(7)]
    assert detect_isolated_bars(rows, REF) == []


def test_sparse_early_history_skipped_by_min_active():
    # Only 2 labels exist at all → active < min_active(5); cannot judge → no flags.
    rows = [Bar("S0", date(2010, 1, 4)), Bar("S1", date(2010, 1, 5))]
    assert detect_isolated_bars(rows, {"S0", "S1"}) == []


def test_non_reference_labels_are_ignored():
    # A crypto/FX label outside the reference group is never judged.
    rows = _real_day(date(2026, 1, 5))
    rows += [Bar("BTC/USD", date(2026, 1, 10))]  # weekend crypto, not in REF
    assert detect_isolated_bars(rows, REF) == []
