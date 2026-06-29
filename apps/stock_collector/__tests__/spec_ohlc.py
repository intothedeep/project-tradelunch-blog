from datetime import date

from collector.transform.ohlc import to_history_rows


def _candle(d, o, h, low, c, v):
    return {"date": d, "open": o, "high": h, "low": low, "close": c, "volume": v}


def test_builds_sorted_rows_with_label_key():
    candles = [
        _candle("2026-01-02", 2, 3, 1, 2.5, 100),
        _candle("2026-01-01", 1, 2, 0.5, 1.5, 50),
    ]
    rows = to_history_rows("AAPL", candles, interval="1d")
    assert [r.bar_time for r in rows] == [date(2026, 1, 1), date(2026, 1, 2)]
    assert rows[0].label == "AAPL" and rows[0].interval == "1d"
    assert rows[1].close == 2.5 and rows[1].volume == 100


def test_malformed_candle_is_skipped():
    candles = [
        _candle("2026-01-01", 1, 2, 0.5, 1.5, 50),
        {"date": "2026-01-02", "open": "x", "high": 1, "low": 1, "close": 1, "volume": 1},
        {"date": "2026-01-03"},  # missing fields
    ]
    rows = to_history_rows("AAPL", candles)
    assert len(rows) == 1


def test_duplicate_date_keeps_last():
    candles = [
        _candle("2026-01-01", 1, 2, 0.5, 1.5, 50),
        _candle("2026-01-01", 9, 9, 9, 9.9, 999),
    ]
    rows = to_history_rows("AAPL", candles)
    assert len(rows) == 1 and rows[0].close == 9.9


def test_datetime_and_volume_coercion():
    rows = to_history_rows("X", [_candle("2026-01-01", 1, 2, 0.5, 1.5, "50.0")])
    assert rows[0].volume == 50 and isinstance(rows[0].volume, int)
