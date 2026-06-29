import math

import pandas as pd

from collector.sink.yahoo_fetch import _frame_to_candles, _num


def test_num_handles_nan_and_none():
    assert _num(None) is None
    assert _num(float("nan")) is None
    assert _num(float("nan"), default=3.0) == 3.0
    assert _num("2.5") == 2.5


def test_frame_captures_archive_fields():
    df = pd.DataFrame(
        {
            "Open": [1.0], "High": [2.0], "Low": [0.5], "Close": [1.5], "Volume": [100],
            "Adj Close": [1.4], "Dividends": [0.25], "Stock Splits": [2.0],
        },
        index=pd.to_datetime(["2026-01-02"]).rename("Date"),
    )
    [c] = _frame_to_candles(df)
    assert c["close"] == 1.5
    assert c["adj_close"] == 1.4
    assert c["dividends"] == 0.25
    assert c["stock_splits"] == 2.0


def test_adj_close_falls_back_to_close_when_missing():
    df = pd.DataFrame(
        {"Open": [1.0], "High": [2.0], "Low": [0.5], "Close": [1.5], "Volume": [100]},
        index=pd.to_datetime(["2026-01-02"]).rename("Date"),
    )
    [c] = _frame_to_candles(df)
    assert c["adj_close"] == 1.5
    assert c["dividends"] is None and c["stock_splits"] is None


def test_nan_dividend_becomes_none():
    df = pd.DataFrame(
        {
            "Open": [1.0], "High": [2.0], "Low": [0.5], "Close": [1.5], "Volume": [100],
            "Dividends": [math.nan],
        },
        index=pd.to_datetime(["2026-01-02"]).rename("Date"),
    )
    [c] = _frame_to_candles(df)
    assert c["dividends"] is None
