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


def test_nan_close_bar_is_dropped():
    # yfinance provisional bar: O/H/L filled, close=NaN. float('nan') does not
    # raise, so without the guard this would persist a NaN close.
    candles = [
        _candle("2026-01-01", 1, 2, 0.5, 1.5, 50),
        _candle("2026-01-02", 1, 2, 0.5, float("nan"), 60),
    ]
    rows = to_history_rows("KOSPI 200", candles)
    assert [r.bar_time for r in rows] == [date(2026, 1, 1)]


def test_nan_in_any_ohlc_field_is_dropped():
    candles = [_candle("2026-01-01", float("nan"), 2, 0.5, 1.5, 50)]
    assert to_history_rows("X", candles) == []


def test_weekend_bars_dropped_by_default():
    # Yahoo returns spurious Sat/Sun bars for markets closed on weekends
    # (equities/indices/FX). 2026-01-02=Fri, 01-03=Sat, 01-04=Sun, 01-05=Mon.
    candles = [
        _candle("2026-01-02", 1, 2, 0.5, 1.5, 50),
        _candle("2026-01-03", 9, 9, 9, 9.0, 10),  # Saturday — artifact
        _candle("2026-01-04", 8, 8, 8, 8.0, 10),  # Sunday — artifact
        _candle("2026-01-05", 2, 3, 1, 2.5, 60),
    ]
    rows = to_history_rows("TQQQ", candles)
    assert [r.bar_time for r in rows] == [date(2026, 1, 2), date(2026, 1, 5)]


def test_weekend_bars_kept_for_crypto():
    # Crypto trades 24/7 — weekend bars are real observations, keep them.
    candles = [
        _candle("2026-01-02", 1, 2, 0.5, 1.5, 50),
        _candle("2026-01-03", 9, 9, 9, 9.0, 10),  # Saturday — valid for crypto
        _candle("2026-01-04", 8, 8, 8, 8.0, 10),  # Sunday — valid for crypto
    ]
    rows = to_history_rows("BTC/USD", candles, allow_weekends=True)
    assert [r.bar_time for r in rows] == [
        date(2026, 1, 2),
        date(2026, 1, 3),
        date(2026, 1, 4),
    ]
