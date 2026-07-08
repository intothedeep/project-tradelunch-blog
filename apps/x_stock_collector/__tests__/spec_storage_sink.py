from pathlib import Path

from collector.sink.storage_sink import object_key


def test_object_key_is_posix_relative_path():
    base = Path("/tmp/archive")
    path = base / "market" / "yahoo" / "AAPL" / "AAPL_2026.parquet"
    assert object_key(base, path) == "market/yahoo/AAPL/AAPL_2026.parquet"


def test_object_key_preserves_safe_symbol_dir():
    base = Path("/data/parquet")
    path = base / "market" / "yahoo" / "_GSPC" / "_GSPC_2025.parquet"
    assert object_key(base, path) == "market/yahoo/_GSPC/_GSPC_2025.parquet"
