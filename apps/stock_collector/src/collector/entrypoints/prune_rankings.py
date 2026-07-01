"""Entrypoint: market_rankings retention prune (Phase N) — DORMANT safeguard.

Purpose: hard-DELETE market_rankings rows older than a calendar-year window once
their Parquet archive is confirmed present. market_rankings is a point-in-time,
NON-REPRODUCIBLE size / relative-strength snapshot (shares-outstanding history is
not stored), so the ML retention window is LONG (default 10 years) and
archive-verify is the safe precondition before any delete.

STATUS — forward-looking safeguard, archive-backed:
  The weekly rankings series began recently, so with a 10-year window there are
  ZERO prune candidates until ~2036. The archive prerequisite IS in place: the
  weekly workflow runs ``archive_rankings`` after each ranking insert, writing
  ``rankings/{YYYY}.parquet`` to Storage. The prune runs annually with
  --verify-archive ON (a year is deleted only once its Parquet object is
  confirmed present); scheduled runs stay dry-run — the first LIVE prune is a
  deliberate workflow_dispatch with dry_run unchecked.

Flow (entrypoints -> config|transform -> sink):
  today ONCE -> prune_cutoff(today, years) -> read_rankings_prune_years ->
  (verify: per-year object_exists, ALL-or-skip) ->
  (dry-run: report) | (live: delete_rankings_before + commit) -> insert_batch_log.

Invariants:
  - ``today`` is read ONCE at the IO boundary.
  - When --verify-archive: NO delete unless EVERY candidate year's Parquet object
    is confirmed present (all-or-nothing; never partial-delete domain data).
  - ``--dry-run`` reports candidates, no DB writes.

Side effects: network HEAD (if verify) + DB DELETE (if live) + one batch_log row.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import database_url, parquet_bucket, supabase_storage
from collector.sink import db_sink
from collector.sink.storage_sink import object_exists
from collector.transform.retention import prune_cutoff

# Parquet key prefix for the (future) rankings cold-archive, within the shared
# COLLECTOR_MARKET_PARQUET_BUCKET. One object per calendar year: rankings/{YYYY}.parquet.
_RANKINGS_ARCHIVE_PREFIX = "rankings"


def _all_years_archived(
    base_url: str,
    secret_key: str,
    bucket: str,
    years: list[int],
) -> tuple[bool, list[int]]:
    """Return (all_present, missing_years). Probe one Parquet object per year."""
    missing = [
        yr
        for yr in years
        if not object_exists(
            base_url, secret_key, bucket, f"{_RANKINGS_ARCHIVE_PREFIX}/{yr}.parquet"
        )
    ]
    return len(missing) == 0, missing


def main(argv: list[str] | None = None) -> int:
    """Prune market_rankings rows older than the retention window (Phase N)."""
    parser = argparse.ArgumentParser(
        description="Prune market_rankings rows older than the retention window."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="report candidates; no DB writes"
    )
    parser.add_argument(
        "--years",
        type=int,
        default=10,
        help="retention window in years (default: 10, per ML consult)",
    )
    parser.add_argument(
        "--verify-archive",
        action=argparse.BooleanOptionalAction,
        default=False,
        help=(
            "require each candidate year's Parquet object before delete "
            "(default: off — dormant until the rankings archive writer exists)"
        ),
    )
    args = parser.parse_args(argv)

    # --- GATES (full no-op when env is missing) ---
    if not database_url():
        print("[prune_rankings] SKIP: DATABASE_URL not set")
        return 0

    storage_url = storage_key = bucket = None
    if args.verify_archive:
        storage_url, storage_key = supabase_storage()
        if not storage_url or not storage_key:
            print(
                "[prune_rankings] SKIP: --verify-archive set but"
                " SUPABASE_URL/SUPABASE_SECRET_KEY missing"
            )
            return 0
        bucket = parquet_bucket()

    today = date.today()  # read ONCE at the IO boundary
    cutoff = prune_cutoff(today, args.years)
    started_at = datetime.now(timezone.utc)

    conn = db_sink.connect()
    status, descr = "success", ""
    deleted = 0

    try:
        years = db_sink.read_rankings_prune_years(conn, cutoff)
        print(
            f"[prune_rankings] cutoff={cutoff} candidate_years={years}"
            f" verify={int(args.verify_archive)} dry_run={int(args.dry_run)}"
        )

        proceed = True
        if not years:
            proceed = False
            descr = f"cutoff={cutoff}|candidate_years=0|deleted=0|dry_run={int(args.dry_run)}"
            print(f"[prune_rankings] nothing to prune (no rows < {cutoff})")
        elif args.verify_archive:
            all_present, missing = _all_years_archived(
                storage_url, storage_key, bucket, years
            )
            if not all_present:
                proceed = False
                descr = (
                    f"cutoff={cutoff}|candidate_years={years}"
                    f"|skipped=archive_missing:{missing}|dry_run={int(args.dry_run)}"
                )
                print(
                    f"  SKIP: missing Parquet year(s) {missing}"
                    " — archive incomplete, NOT pruning"
                )

        if proceed:
            if args.dry_run:
                descr = (
                    f"cutoff={cutoff}|candidate_years={years}|deleted=0|dry_run=1"
                )
                print(
                    f"  DRY-RUN: WOULD delete market_rankings rows for years {years}"
                    f" (< {cutoff})"
                )
            else:
                deleted = db_sink.delete_rankings_before(conn, cutoff)
                conn.commit()
                descr = (
                    f"cutoff={cutoff}|candidate_years={years}|deleted={deleted}|dry_run=0"
                )
                print(
                    f"  PRUNED: deleted {deleted} market_rankings rows"
                    f" (years {years}, < {cutoff})"
                )

        print(f"[prune_rankings] {descr}")

    except Exception as exc:  # noqa: BLE001 — record failure, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[prune_rankings] FAILED {descr}")
        raise

    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-prune-rankings",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
