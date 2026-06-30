"""IO boundary: 13F holdings Parquet cold-archive (Phase L15).

Partition: ``sec13f/{cik}/{cik}_{YYYY}.parquet`` (zstd). Fixed schema mirrors
``sec_holdings`` columns. Columns:
  cik(dict str), accession(str), period_of_report(date32), cusip(str),
  name_of_issuer(str), title_of_class(str nullable), ticker(str nullable),
  shares(int64 nullable), prn_type(str), value_usd(int64), put_call(str),
  discretion(str nullable).

Cross-year invariant: the target year = YEAR OF period_of_report, NOT the
calendar year of the run.  A Q4 period (e.g. 2025-12-31) is collected in
~Feb 2026 but MUST write the {cik}_2025.parquet file.  The writer groups
incoming holdings by year(period_of_report) and read-merge-rewrites each
affected year file (usually 1; in Jan-Feb it may touch the prior-year file).

Read-merge-rewrite per year file: read existing -> concat new rows -> dedupe
by (cik, accession, cusip, put_call, prn_type) keep=last -> sort
(period_of_report, cusip) -> fixed-schema cast -> tmp write -> atomic
os.replace.  Past-year files are immutable (caller must not pass rows from
a past year unless intentionally backfilling via run_backfill).

Side effects: local filesystem only. Storage upload is a separate best-effort
step wired in the entrypoints (L16).
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pyarrow as pa
import pyarrow.parquet as pq

if TYPE_CHECKING:
    from collector.schema.rows import HoldingRow

# ---------------------------------------------------------------------------
# Fixed schema (mirrors sec_holdings columns)
# ---------------------------------------------------------------------------

_SCHEMA = pa.schema(
    [
        ("cik", pa.dictionary(pa.int32(), pa.string())),
        ("accession", pa.string()),
        ("period_of_report", pa.date32()),
        ("cusip", pa.string()),
        ("name_of_issuer", pa.string()),
        ("title_of_class", pa.string()),   # nullable
        ("ticker", pa.string()),           # nullable
        ("shares", pa.int64()),            # nullable
        ("prn_type", pa.string()),
        ("value_usd", pa.int64()),
        ("put_call", pa.string()),
        ("discretion", pa.string()),       # nullable
    ]
)

# Dedup key columns (mirrors sec_holdings ON CONFLICT PK)
_DEDUP_KEY = ("cik", "accession", "cusip", "put_call", "prn_type")


# ---------------------------------------------------------------------------
# Pure path helper
# ---------------------------------------------------------------------------


def sec_parquet_path(base: Path, cik: str, year: int) -> Path:
    """``base/sec13f/{cik}/{cik}_{YYYY}.parquet``."""
    return base / "sec13f" / cik / f"{cik}_{year}.parquet"


# ---------------------------------------------------------------------------
# Pure transform: group records by year(period_of_report)
# ---------------------------------------------------------------------------


def group_by_period_year(
    records: Sequence[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    """Group holding records by year(period_of_report). Pure."""
    groups: dict[int, list[dict[str, Any]]] = {}
    for r in records:
        year = r["period_of_report"].year
        groups.setdefault(year, []).append(r)
    return groups


def holding_rows_to_records(rows: Sequence["HoldingRow"]) -> list[dict[str, Any]]:
    """Convert HoldingRow dataclasses -> plain dicts for write_holdings. Pure."""
    return [
        {
            "cik": r.cik,
            "accession": r.accession,
            "period_of_report": r.period_of_report,
            "cusip": r.cusip,
            "name_of_issuer": r.name_of_issuer,
            "title_of_class": r.title_of_class,
            "ticker": r.ticker,
            "shares": r.shares,
            "prn_type": r.prn_type,
            "value_usd": r.value_usd,
            "put_call": r.put_call,
            "discretion": r.discretion,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Parquet table builder (pure)
# ---------------------------------------------------------------------------


def _to_table(records: Sequence[dict[str, Any]]) -> pa.Table:
    """Build a pyarrow Table from holding record dicts using the fixed schema."""
    data: dict[str, list] = {
        "cik": [r["cik"] for r in records],
        "accession": [r["accession"] for r in records],
        "period_of_report": [r["period_of_report"] for r in records],
        "cusip": [r["cusip"] for r in records],
        "name_of_issuer": [r["name_of_issuer"] for r in records],
        "title_of_class": [r.get("title_of_class") for r in records],
        "ticker": [r.get("ticker") for r in records],
        "shares": [r.get("shares") for r in records],
        "prn_type": [r.get("prn_type") or "" for r in records],
        "value_usd": [int(r["value_usd"]) for r in records],
        "put_call": [r.get("put_call") or "" for r in records],
        "discretion": [r.get("discretion") for r in records],
    }
    return pa.table(data, schema=_SCHEMA)


# ---------------------------------------------------------------------------
# Dedup + sort helpers (Python-level — avoids pyarrow sort limitation on
# dictionary columns; rows are small enough per CIK per year)
# ---------------------------------------------------------------------------


def _dedup_keep_last(table: pa.Table) -> pa.Table:
    """Dedupe by _DEDUP_KEY keeping the last row per key (stable insertion order).

    Uses Python-level iteration to avoid pyarrow's sort_by limitation on
    dictionary-typed columns.
    """
    cik_col = table.column("cik")
    if pa.types.is_dictionary(cik_col.type):
        cik_strs = cik_col.cast(pa.string()).to_pylist()
    else:
        cik_strs = cik_col.to_pylist()

    accession = table.column("accession").to_pylist()
    cusip = table.column("cusip").to_pylist()
    put_call = table.column("put_call").to_pylist()
    prn_type = table.column("prn_type").to_pylist()

    # Walk forward; last row per key wins (overwrite index map)
    key_to_last: dict[tuple, int] = {}
    for i in range(table.num_rows):
        key = (cik_strs[i], accession[i], cusip[i], put_call[i], prn_type[i])
        key_to_last[key] = i

    keep = sorted(key_to_last.values())
    return table.take(pa.array(keep, type=pa.int64()))


def _sort_by_period_cusip(table: pa.Table) -> pa.Table:
    """Sort by (period_of_report, cusip). Both types are natively sortable."""
    return table.sort_by([("period_of_report", "ascending"), ("cusip", "ascending")])


# ---------------------------------------------------------------------------
# Read-merge-rewrite for a single year file
# ---------------------------------------------------------------------------


def _write_year_file(path: Path, new_tbl: pa.Table) -> None:
    """Read-merge-rewrite one year parquet file. Atomic via tmp + os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        existing = pq.read_table(path)
        combined = pa.concat_tables([existing.cast(_SCHEMA), new_tbl])
    else:
        combined = new_tbl

    deduped = _dedup_keep_last(combined)
    sorted_tbl = _sort_by_period_cusip(deduped)

    tmp = path.with_suffix(".parquet.tmp")
    pq.write_table(sorted_tbl, tmp, compression="zstd")
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Public entrypoints
# ---------------------------------------------------------------------------


def write_holdings(
    base: Path,
    cik: str,
    records: Sequence[dict[str, Any]],
) -> list[Path]:
    """Write (read-merge-rewrite) all affected year files for one fund's holdings.

    Groups records by year(period_of_report) and writes one file per year.
    Returns the list of parquet paths written (usually 1; may be 2 during
    Jan-Feb when a Q4 prior-year filing is collected).
    """
    if not records:
        return []
    groups = group_by_period_year(records)
    written: list[Path] = []
    for year, year_records in sorted(groups.items()):
        tbl = _to_table(year_records)
        path = sec_parquet_path(base, cik, year)
        _write_year_file(path, tbl)
        written.append(path)
    return written


def write_holding_rows(
    base: Path,
    cik: str,
    rows: Sequence["HoldingRow"],
) -> list[Path]:
    """Convenience wrapper: convert HoldingRow -> records then write. Pure sink."""
    return write_holdings(base, cik, holding_rows_to_records(rows))
