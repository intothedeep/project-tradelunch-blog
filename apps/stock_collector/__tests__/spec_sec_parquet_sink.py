"""Tests for sec_parquet_sink (Phase L15).

Pure-ish: all I/O against tmp_path (tmp filesystem); no network.
Mirrors spec_parquet_sink.py style.
"""

from datetime import date

import pyarrow.parquet as pq

from collector.sink.sec_parquet_sink import (
    group_by_period_year,
    sec_parquet_path,
    write_holdings,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _holding(
    cik: str = "0001234567",
    accession: str = "0001234567-25-000001",
    period: date = date(2025, 9, 30),
    cusip: str = "037833100",
    name: str = "Apple Inc.",
    value_usd: int = 1_000_000,
    shares: int = 1000,
    put_call: str = "",
    prn_type: str = "SH",
    **extra,
) -> dict:
    base = {
        "cik": cik,
        "accession": accession,
        "period_of_report": period,
        "cusip": cusip,
        "name_of_issuer": name,
        "value_usd": value_usd,
        "shares": shares,
        "put_call": put_call,
        "prn_type": prn_type,
    }
    base.update(extra)
    return base


# ---------------------------------------------------------------------------
# Path helper
# ---------------------------------------------------------------------------


def test_sec_parquet_path_structure(tmp_path):
    p = sec_parquet_path(tmp_path, "0001234567", 2025)
    assert p == tmp_path / "sec13f" / "0001234567" / "0001234567_2025.parquet"


# ---------------------------------------------------------------------------
# Basic write + schema
# ---------------------------------------------------------------------------


def test_write_creates_file(tmp_path):
    paths = write_holdings(tmp_path, "0001234567", [_holding()])
    assert len(paths) == 1
    assert paths[0].exists()
    assert paths[0] == sec_parquet_path(tmp_path, "0001234567", 2025)


def test_schema_has_date32(tmp_path):
    write_holdings(tmp_path, "0001234567", [_holding()])
    tbl = pq.read_table(sec_parquet_path(tmp_path, "0001234567", 2025))
    assert str(tbl.schema.field("period_of_report").type) == "date32[day]"


def test_schema_columns_present(tmp_path):
    write_holdings(tmp_path, "0001234567", [_holding()])
    tbl = pq.read_table(sec_parquet_path(tmp_path, "0001234567", 2025))
    expected = {
        "cik", "accession", "period_of_report", "cusip",
        "name_of_issuer", "title_of_class", "ticker",
        "shares", "prn_type", "value_usd", "put_call", "discretion",
    }
    assert expected.issubset(set(tbl.schema.names))


def test_nullable_columns_accept_none(tmp_path):
    rec = _holding(title_of_class=None, ticker=None, shares=None, discretion=None)
    write_holdings(tmp_path, "0001234567", [rec])
    tbl = pq.read_table(sec_parquet_path(tmp_path, "0001234567", 2025))
    assert tbl.column("title_of_class").to_pylist() == [None]
    assert tbl.column("ticker").to_pylist() == [None]
    assert tbl.column("shares").to_pylist() == [None]
    assert tbl.column("discretion").to_pylist() == [None]


# ---------------------------------------------------------------------------
# Deduplicate by (cik, accession, cusip, put_call, prn_type) keep=last
# ---------------------------------------------------------------------------


def test_same_key_rewrite_dedupes_keep_last(tmp_path):
    cik = "0001234567"
    # First write: value_usd=100
    write_holdings(tmp_path, cik, [_holding(value_usd=100)])
    # Second write: same key, new value_usd=999
    write_holdings(tmp_path, cik, [_holding(value_usd=999)])
    tbl = pq.read_table(sec_parquet_path(tmp_path, cik, 2025))
    # Only one row, with the LAST written value
    assert tbl.num_rows == 1
    assert tbl.column("value_usd").to_pylist() == [999]


def test_different_cusip_not_deduped(tmp_path):
    cik = "0001234567"
    rows = [
        _holding(cusip="037833100", value_usd=100),
        _holding(cusip="594918104", value_usd=200),
    ]
    write_holdings(tmp_path, cik, rows)
    tbl = pq.read_table(sec_parquet_path(tmp_path, cik, 2025))
    assert tbl.num_rows == 2


def test_different_put_call_not_deduped(tmp_path):
    """put_call differentiates a CALL from a straight equity (empty string)."""
    cik = "0001234567"
    rows = [
        _holding(put_call="", value_usd=100),
        _holding(put_call="CALL", value_usd=200),
    ]
    write_holdings(tmp_path, cik, rows)
    tbl = pq.read_table(sec_parquet_path(tmp_path, cik, 2025))
    assert tbl.num_rows == 2


# ---------------------------------------------------------------------------
# Cross-year: period_of_report year, NOT calendar year
# ---------------------------------------------------------------------------


def test_cross_year_writes_prior_year_file(tmp_path):
    """Q4 2024 period collected in 2025 must land in {cik}_2024.parquet."""
    cik = "0001234567"
    rec = _holding(period=date(2024, 12, 31), accession="0001234567-25-000001")
    write_holdings(tmp_path, cik, [rec])
    p2024 = sec_parquet_path(tmp_path, cik, 2024)
    p2025 = sec_parquet_path(tmp_path, cik, 2025)
    assert p2024.exists()
    assert not p2025.exists()


def test_cross_year_multi_period_writes_multiple_files(tmp_path):
    """Records spanning two periods (two years) produce two separate files."""
    cik = "0001234567"
    rows = [
        _holding(period=date(2024, 12, 31), accession="0001234567-25-000001", cusip="037833100"),
        _holding(period=date(2025, 3, 31),  accession="0001234567-25-000002", cusip="037833100"),
    ]
    paths = write_holdings(tmp_path, cik, rows)
    assert len(paths) == 2
    assert sec_parquet_path(tmp_path, cik, 2024) in paths
    assert sec_parquet_path(tmp_path, cik, 2025) in paths
    assert sec_parquet_path(tmp_path, cik, 2024).exists()
    assert sec_parquet_path(tmp_path, cik, 2025).exists()


# ---------------------------------------------------------------------------
# group_by_period_year (pure)
# ---------------------------------------------------------------------------


def test_group_by_period_year_pure():
    rows = [
        _holding(period=date(2024, 12, 31), cusip="AAA"),
        _holding(period=date(2025, 3, 31),  cusip="BBB"),
        _holding(period=date(2025, 6, 30),  cusip="CCC"),
    ]
    groups = group_by_period_year(rows)
    assert set(groups.keys()) == {2024, 2025}
    assert len(groups[2024]) == 1
    assert len(groups[2025]) == 2


# ---------------------------------------------------------------------------
# Atomic replace: tmp file is cleaned up
# ---------------------------------------------------------------------------


def test_no_tmp_file_remains(tmp_path):
    write_holdings(tmp_path, "0001234567", [_holding()])
    tmp_files = list((tmp_path / "sec13f" / "0001234567").glob("*.tmp"))
    assert tmp_files == []


# ---------------------------------------------------------------------------
# Empty input: no file written
# ---------------------------------------------------------------------------


def test_empty_records_writes_nothing(tmp_path):
    paths = write_holdings(tmp_path, "0001234567", [])
    assert paths == []
    assert not sec_parquet_path(tmp_path, "0001234567", 2025).exists()
