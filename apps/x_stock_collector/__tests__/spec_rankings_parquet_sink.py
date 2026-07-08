"""Tests for rankings_parquet_sink (Phase N).

Pure-ish: all I/O against tmp_path (tmp filesystem); no network.
Mirrors spec_sec_parquet_sink.py style.
"""

from datetime import date

import pyarrow.parquet as pq

from collector.sink.rankings_parquet_sink import (
    group_by_asof_year,
    rankings_parquet_path,
    write_year,
)


def _row(
    as_of: date = date(2026, 1, 4),
    symbol: str = "AAPL",
    scope: str = "global",
    sector: str | None = "Technology",
    rank: int = 1,
    market_cap: float | None = 3.5e12,
) -> dict:
    return {
        "as_of": as_of,
        "symbol": symbol,
        "scope": scope,
        "sector": sector,
        "rank": rank,
        "market_cap": market_cap,
    }


# --- group_by_asof_year -----------------------------------------------------

def test_group_by_asof_year_splits_by_year():
    rows = [_row(as_of=date(2025, 12, 28)), _row(as_of=date(2026, 1, 4))]
    groups = group_by_asof_year(rows)
    assert set(groups) == {2025, 2026}
    assert len(groups[2025]) == 1 and len(groups[2026]) == 1


# --- write_year -------------------------------------------------------------

def test_write_year_creates_year_file(tmp_path):
    path = write_year(tmp_path, 2026, [_row()])
    assert path == rankings_parquet_path(tmp_path, 2026)
    assert path.exists()
    assert pq.read_table(path).num_rows == 1


def test_write_year_empty_records_returns_none(tmp_path):
    assert write_year(tmp_path, 2026, []) is None
    assert not rankings_parquet_path(tmp_path, 2026).exists()


def test_write_year_dedupes_by_pk_keep_last(tmp_path):
    # Same (as_of, symbol, scope) twice — the LAST rank must win.
    rows = [
        _row(rank=5, market_cap=1.0e12),
        _row(rank=2, market_cap=2.0e12),
    ]
    path = write_year(tmp_path, 2026, rows)
    tbl = pq.read_table(path)
    assert tbl.num_rows == 1
    assert tbl.column("rank").to_pylist() == [2]


def test_write_year_distinct_scopes_kept(tmp_path):
    rows = [_row(scope="global"), _row(scope="sector")]
    tbl = pq.read_table(write_year(tmp_path, 2026, rows))
    assert tbl.num_rows == 2


def test_write_year_read_merge_rewrite_accumulates(tmp_path):
    write_year(tmp_path, 2026, [_row(symbol="AAPL")])
    path = write_year(tmp_path, 2026, [_row(symbol="MSFT", rank=2)])
    symbols = pq.read_table(path).column("symbol").to_pylist()
    assert set(symbols) == {"AAPL", "MSFT"}


def test_write_year_sorted_by_asof_scope_rank(tmp_path):
    rows = [
        _row(symbol="C", scope="global", rank=3),
        _row(symbol="A", scope="global", rank=1),
        _row(symbol="B", scope="global", rank=2),
    ]
    tbl = pq.read_table(write_year(tmp_path, 2026, rows))
    assert tbl.column("rank").to_pylist() == [1, 2, 3]


def test_write_year_preserves_nullable_fields(tmp_path):
    tbl = pq.read_table(
        write_year(tmp_path, 2026, [_row(sector=None, market_cap=None)])
    )
    assert tbl.column("sector").to_pylist() == [None]
    assert tbl.column("market_cap").to_pylist() == [None]
