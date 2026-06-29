"""IO boundary: Parquet archive (Phase 1.5) — analytics, NOT serving.

Partition: ``market/{source}/{ticker}/{ticker}_{YYYY}.parquet`` (zstd). Fixed
schema: symbol(dict str), date(date32), open/high/low/close/adj_close(f64),
volume(i64), dividends/stock_splits(f64 nullable).

Current-year file = READ-MERGE-REWRITE (no row upsert in Parquet): read existing
-> concat new -> dedupe by date (keep=last) -> sort -> cast fixed schema ->
write tmp -> atomic ``os.replace``. Past-year files are immutable.

Side effects: local filesystem only (Storage upload is a separate CI step,
USER-gated on SUPABASE_SERVICE_ROLE + a PRIVATE bucket).
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

_SCHEMA = pa.schema(
    [
        ("symbol", pa.dictionary(pa.int32(), pa.string())),
        ("date", pa.date32()),
        ("open", pa.float64()),
        ("high", pa.float64()),
        ("low", pa.float64()),
        ("close", pa.float64()),
        ("adj_close", pa.float64()),
        ("volume", pa.int64()),
        ("dividends", pa.float64()),
        ("stock_splits", pa.float64()),
    ]
)
_COLUMNS = [f.name for f in _SCHEMA]


def parquet_path(base: Path, source: str, ticker: str, year: int) -> Path:
    """``base/market/{source}/{ticker}/{ticker}_{YYYY}.parquet``."""
    return base / "market" / source / ticker / f"{ticker}_{year}.parquet"


def _to_table(records: Sequence[dict[str, Any]]) -> pa.Table:
    # build column-wise; adj_close defaults to close, dividends/splits nullable
    data = {
        "symbol": [r["symbol"] for r in records],
        "date": [r["date"] for r in records],
        "open": [float(r["open"]) for r in records],
        "high": [float(r["high"]) for r in records],
        "low": [float(r["low"]) for r in records],
        "close": [float(r["close"]) for r in records],
        "adj_close": [float(r.get("adj_close", r["close"])) for r in records],
        "volume": [int(r["volume"]) for r in records],
        "dividends": [r.get("dividends") for r in records],
        "stock_splits": [r.get("stock_splits") for r in records],
    }
    return pa.table(data, schema=_SCHEMA)


def write_year(
    base: Path, source: str, ticker: str, year: int, records: Sequence[dict[str, Any]]
) -> Path:
    """Read-merge-rewrite the current-year file; dedupe by date (keep last)."""
    path = parquet_path(base, source, ticker, year)
    path.parent.mkdir(parents=True, exist_ok=True)

    new_tbl = _to_table(records)
    if path.exists():
        existing = pq.read_table(path)
        combined = pa.concat_tables([existing.cast(_SCHEMA), new_tbl])
    else:
        combined = new_tbl

    # dedupe by date keeping the LAST occurrence: stable index, keep max index per date
    n = combined.num_rows
    idx = pa.array(range(n), type=pa.int64())
    combined = combined.append_column("_idx", idx)
    combined = combined.sort_by([("date", "ascending"), ("_idx", "ascending")])
    dates = combined.column("date").to_pylist()
    keep: list[int] = []
    for i in range(combined.num_rows):
        if i + 1 == combined.num_rows or dates[i] != dates[i + 1]:
            keep.append(i)
    deduped = combined.take(pa.array(keep, type=pa.int64())).drop_columns(["_idx"])

    tmp = path.with_suffix(".parquet.tmp")
    pq.write_table(deduped, tmp, compression="zstd")
    os.replace(tmp, path)
    return path
