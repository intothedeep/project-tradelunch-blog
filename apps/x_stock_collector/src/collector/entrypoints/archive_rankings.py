"""Entrypoint: archive market_rankings to Parquet cold-storage (Phase N).

Reads market_rankings from the DB, writes ONE Parquet file per calendar year of
``as_of`` (``rankings/{YYYY}.parquet``), then best-effort uploads each written
file to the private Supabase Storage bucket. This is the archive that
``prune_rankings --verify-archive`` probes before it may hard-delete an old year
of the (non-reproducible) rankings series.

Wired into the WEEKLY workflow after run_weekly inserts the week's rankings, so
the current-year file stays fresh. Idempotent: rankings_parquet_sink read-merge-
rewrite de-dupes by (as_of, symbol, scope), so re-running only refreshes rows.

Gates:
  - DATABASE_URL required (full no-op SKIP otherwise).
  - Storage upload is BEST-EFFORT: when SUPABASE_URL / SUPABASE_SECRET_KEY are
    unset (bucket not provisioned), the local Parquet is still written and the
    job exits 0 — an archive-upload failure must not fail the weekly collection.

Flow (entrypoints -> config -> sink): connect -> resolve year(s) -> per year:
  read_rankings_by_year -> write_year (local Parquet) -> upload_object (best-effort).

Side effects: DB read + filesystem write + network (Storage upload).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from collector.config.settings import (
    database_url,
    parquet_bucket,
    parquet_dir,
    supabase_storage,
)
from collector.sink import db_sink, rankings_parquet_sink
from collector.sink.storage_sink import object_key, upload_object


def main(argv: list[str] | None = None) -> int:
    """Archive market_rankings to Parquet (per year) + best-effort Storage upload."""
    parser = argparse.ArgumentParser(
        description="Archive market_rankings to Parquet cold-storage (per as_of year)."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=0,
        help="archive a single as_of year (0 = every year present in the DB)",
    )
    args = parser.parse_args(argv)

    # --- GATE (full no-op when env is missing) ---
    if not database_url():
        print("[archive_rankings] SKIP: DATABASE_URL not set")
        return 0

    base: Path = parquet_dir()
    url, secret_key = supabase_storage()
    bucket = parquet_bucket()

    conn = db_sink.connect()
    written = 0
    rows_total = 0
    uploaded = 0
    try:
        years = [args.year] if args.year else db_sink.read_rankings_years(conn)
        print(
            f"[archive_rankings] years={years} storage={'on' if url and secret_key else 'off'}"
        )

        for year in years:
            records = db_sink.read_rankings_by_year(conn, year)
            path = rankings_parquet_sink.write_year(base, year, records)
            if path is None:
                continue
            written += 1
            rows_total += len(records)
            print(f"  WROTE rankings/{year}.parquet ({len(records)} rows)")

            # Best-effort upload — never fails the job.
            if url and secret_key:
                key = object_key(base, path)
                if upload_object(url, secret_key, bucket, key, path.read_bytes()):
                    uploaded += 1
                else:
                    print(f"  UPLOAD FAILED {key}")
    finally:
        conn.close()

    print(
        f"[archive_rankings] files={written} rows={rows_total}"
        f" uploaded={uploaded} -> {base}"
    )
    return 0  # best-effort: never fail the weekly job on the archive step


if __name__ == "__main__":
    sys.exit(main())
