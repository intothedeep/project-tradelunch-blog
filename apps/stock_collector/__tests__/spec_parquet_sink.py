from datetime import date

import pyarrow.parquet as pq

from collector.sink.parquet_sink import parquet_path, write_year


def _rec(d, close, **extra):
    base = {
        "symbol": "AAPL", "date": d, "open": close, "high": close,
        "low": close, "close": close, "volume": 100,
    }
    base.update(extra)
    return base


def test_writes_partition_path(tmp_path):
    p = write_year(tmp_path, "yahoo", "AAPL", 2026, [_rec(date(2026, 1, 2), 1.0)])
    assert p == parquet_path(tmp_path, "yahoo", "AAPL", 2026)
    assert p.exists()


def test_schema_has_date32_and_extra_columns(tmp_path):
    write_year(tmp_path, "yahoo", "AAPL", 2026, [_rec(date(2026, 1, 2), 1.0)])
    tbl = pq.read_table(parquet_path(tmp_path, "yahoo", "AAPL", 2026))
    assert str(tbl.schema.field("date").type) == "date32[day]"
    for col in ("adj_close", "dividends", "stock_splits"):
        assert col in tbl.schema.names


def test_adj_close_defaults_to_close(tmp_path):
    write_year(tmp_path, "yahoo", "AAPL", 2026, [_rec(date(2026, 1, 2), 7.5)])
    tbl = pq.read_table(parquet_path(tmp_path, "yahoo", "AAPL", 2026))
    assert tbl.column("adj_close").to_pylist() == [7.5]


def test_read_merge_rewrite_dedupes_by_date_keep_last(tmp_path):
    write_year(tmp_path, "yahoo", "AAPL", 2026, [_rec(date(2026, 1, 2), 1.0)])
    # rewrite same date with a new close + a new date
    write_year(
        tmp_path, "yahoo", "AAPL", 2026,
        [_rec(date(2026, 1, 2), 9.9), _rec(date(2026, 1, 3), 2.0)],
    )
    tbl = pq.read_table(parquet_path(tmp_path, "yahoo", "AAPL", 2026)).sort_by("date")
    assert tbl.column("date").to_pylist() == [date(2026, 1, 2), date(2026, 1, 3)]
    assert tbl.column("close").to_pylist() == [9.9, 2.0]  # keep=last


def test_dividends_splits_persisted(tmp_path):
    write_year(
        tmp_path, "yahoo", "AAPL", 2026,
        [_rec(date(2026, 1, 2), 1.0, dividends=0.25, stock_splits=2.0)],
    )
    tbl = pq.read_table(parquet_path(tmp_path, "yahoo", "AAPL", 2026))
    assert tbl.column("dividends").to_pylist() == [0.25]
    assert tbl.column("stock_splits").to_pylist() == [2.0]
