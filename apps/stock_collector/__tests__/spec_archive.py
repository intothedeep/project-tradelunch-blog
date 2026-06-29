from datetime import date, datetime

from collector.transform.archive import to_parquet_records


def _candle(d, close=1.0, **extra):
    base = {"date": d, "open": close, "high": close, "low": close, "close": close, "volume": 100}
    base.update(extra)
    return base


def test_groups_by_calendar_year():
    candles = [_candle(date(2025, 12, 31)), _candle(date(2026, 1, 2))]
    out = to_parquet_records("AAPL", candles)
    assert set(out) == {2025, 2026}
    assert [r["date"] for r in out[2026]] == [date(2026, 1, 2)]


def test_dedupes_by_date_keep_last_sorted():
    candles = [_candle(date(2026, 1, 3), 2.0), _candle(date(2026, 1, 2), 1.0), _candle(date(2026, 1, 2), 9.9)]
    recs = to_parquet_records("AAPL", candles)[2026]
    assert [r["date"] for r in recs] == [date(2026, 1, 2), date(2026, 1, 3)]
    assert recs[0]["close"] == 9.9  # keep last


def test_adj_close_defaults_to_close_when_absent():
    recs = to_parquet_records("AAPL", [_candle(date(2026, 1, 2), 7.5)])[2026]
    assert recs[0]["adj_close"] == 7.5


def test_dividends_and_splits_pass_through():
    recs = to_parquet_records(
        "AAPL", [_candle(date(2026, 1, 2), adj_close=7.0, dividends=0.25, stock_splits=2.0)]
    )[2026]
    assert recs[0]["adj_close"] == 7.0
    assert recs[0]["dividends"] == 0.25
    assert recs[0]["stock_splits"] == 2.0


def test_datetime_date_normalized_to_date():
    recs = to_parquet_records("AAPL", [_candle(datetime(2026, 1, 2, 16, 0))])[2026]
    assert recs[0]["date"] == date(2026, 1, 2)


def test_malformed_candle_skipped():
    out = to_parquet_records("AAPL", [{"date": date(2026, 1, 2)}, _candle(date(2026, 1, 3))])
    assert [r["date"] for r in out[2026]] == [date(2026, 1, 3)]
