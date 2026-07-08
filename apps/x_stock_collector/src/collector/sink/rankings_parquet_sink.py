"""IO boundary: market_rankings Parquet cold-archive (Phase N).

Partition: ``rankings/{YYYY}.parquet`` (zstd) — ONE file per calendar year of
``as_of`` (all symbols + scopes for that year). Fixed schema mirrors the
market_rankings columns:
  as_of(date32), symbol(str), scope(str), sector(str nullable),
  rank(int32), market_cap(f64 nullable).

Rationale: market_rankings is a point-in-time, NON-REPRODUCIBLE size /
relative-strength snapshot (shares-outstanding history is not stored), so before
the retention prune (Phase N) can hard-delete an old year, that year's rows must
first survive as a cold Parquet copy. This is the archive that
``prune_rankings --verify-archive`` probes.

Read-merge-rewrite per year file: read existing -> concat new rows -> dedupe by
(as_of, symbol, scope) keep=last -> sort (as_of, scope, rank) -> fixed-schema
cast -> tmp write -> atomic ``os.replace``. All rows in one file share the same
year (the caller groups by year(as_of)); past-year files stay stable unless a
backfill intentionally rewrites them.

Side effects: local filesystem only. Storage upload is a separate best-effort
step wired in the entrypoint (archive_rankings).
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
        ("as_of", pa.date32()),
        ("symbol", pa.string()),
        ("scope", pa.string()),
        ("sector", pa.string()),      # nullable
        ("rank", pa.int32()),
        ("market_cap", pa.float64()),  # nullable
    ]
)

# Dedup key columns (mirror the market_rankings PK).
_DEDUP_KEY = ("as_of", "symbol", "scope")


def rankings_parquet_path(base: Path, year: int) -> Path:
    """``base/rankings/{YYYY}.parquet``."""
    return base / "rankings" / f"{year}.parquet"


def group_by_asof_year(
    records: Sequence[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    """Group ranking records by year(as_of). Pure."""
    groups: dict[int, list[dict[str, Any]]] = {}
    for r in records:
        groups.setdefault(r["as_of"].year, []).append(r)
    return groups


def _to_table(records: Sequence[dict[str, Any]]) -> pa.Table:
    """Build a pyarrow Table from ranking record dicts using the fixed schema."""
    data: dict[str, list] = {
        "as_of": [r["as_of"] for r in records],
        "symbol": [r["symbol"] for r in records],
        "scope": [r["scope"] for r in records],
        "sector": [r.get("sector") for r in records],
        "rank": [int(r["rank"]) for r in records],
        "market_cap": [
            None if r.get("market_cap") is None else float(r["market_cap"])
            for r in records
        ],
    }
    return pa.table(data, schema=_SCHEMA)


def _dedup_keep_last(table: pa.Table) -> pa.Table:
    """Dedupe by _DEDUP_KEY keeping the last row per key (stable insertion order)."""
    as_of = table.column("as_of").to_pylist()
    symbol = table.column("symbol").to_pylist()
    scope = table.column("scope").to_pylist()

    key_to_last: dict[tuple, int] = {}
    for i in range(table.num_rows):
        key_to_last[(as_of[i], symbol[i], scope[i])] = i

    keep = sorted(key_to_last.values())
    return table.take(pa.array(keep, type=pa.int64()))


def _sort_by_asof_scope_rank(table: pa.Table) -> pa.Table:
    """Sort by (as_of, scope, rank) — all natively sortable types."""
    return table.sort_by(
        [("as_of", "ascending"), ("scope", "ascending"), ("rank", "ascending")]
    )


def write_year(
    base: Path, year: int, records: Sequence[dict[str, Any]]
) -> Path | None:
    """Read-merge-rewrite one year file; dedupe by (as_of, symbol, scope) keep last.

    Returns the parquet path written, or None when ``records`` is empty.
    """
    if not records:
        return None
    path = rankings_parquet_path(base, year)
    path.parent.mkdir(parents=True, exist_ok=True)

    new_tbl = _to_table(records)
    if path.exists():
        existing = pq.read_table(path)
        combined = pa.concat_tables([existing.cast(_SCHEMA), new_tbl])
    else:
        combined = new_tbl

    deduped = _dedup_keep_last(combined)
    sorted_tbl = _sort_by_asof_scope_rank(deduped)

    tmp = path.with_suffix(".parquet.tmp")
    pq.write_table(sorted_tbl, tmp, compression="zstd")
    os.replace(tmp, path)
    return path
