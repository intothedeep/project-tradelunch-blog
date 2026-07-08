"""Entrypoint: 13F DB retention prune — hard-delete old sec_holdings/sec_filings.

SANCTIONED HARD-DELETE EXCEPTION (Phase L L18):
  This entrypoint performs hard-DELETE on sec_holdings and sec_filings rows.
  This is an OWNER-SIGNED-OFF exception to the repo's soft-delete rule, scoped
  STRICTLY to derived + archived 13F operational rows. It NEVER applies to any
  user-generated content. Archive precondition (Parquet object-exists) is the
  safety gate: a period is pruned ONLY if its parquet object is confirmed present.

Purpose: keep the 13F DB tables lean by removing periods older than
keep_quarters most-recent distinct quarters (default 12 = 3 years), safely
above the 2yr/8q serving window used by the dashboard.

Flow (layer direction entrypoints -> config|transform -> sink):
  load fund CIKs -> per CIK: read_all_periods -> holdings_prune_periods (pure)
  -> per candidate period: verify parquet object_exists (Storage) -> if present:
  prune_period + commit; else SKIP (log) -> insert_batch_log.

Invariants:
  - A period is hard-deleted ONLY when its parquet archive object is confirmed
    present at sec13f/{cik}/{cik}_{YYYY}.parquet. SKIP otherwise (never risk loss).
  - ``--dry-run`` prints candidates + archive status, no DB writes.
  - Commit is per-period (partial progress survives interruption).
  - ``--cik`` restricts to a single CIK (optional; default: all funds.yaml CIKs).
  - insert_batch_log is always written (try/finally), even on partial failure.

Side effects: network HEAD (Storage object probes) + DB DELETE (if not dry-run).
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.funds_loader import load_funds
from collector.config.settings import (
    database_url,
    sec_parquet_bucket,
    supabase_storage,
)
from collector.sink import db_sink, sec_db_sink
from collector.sink.storage_sink import object_exists
from collector.transform.retention import holdings_prune_periods

_DEFAULT_KEEP_QUARTERS = 12  # 3 years, safely above the 2yr/8q serving window


def _parquet_object_path(cik: str, period_year: int) -> str:
    """Canonical Parquet object key for a 13F period year."""
    return f"sec13f/{cik}/{cik}_{period_year}.parquet"


def _archive_confirmed(
    base_url: str,
    secret_key: str,
    bucket: str,
    cik: str,
    period_year: int,
) -> bool:
    """Probe whether the Parquet archive object for (cik, year) exists."""
    return object_exists(
        base_url,
        secret_key,
        bucket,
        _parquet_object_path(cik, period_year),
    )


def main(argv: list[str] | None = None) -> int:
    """Hard-delete old 13F periods confirmed archived to Supabase Storage."""
    parser = argparse.ArgumentParser(
        description=(
            "Prune old sec_holdings/sec_filings periods whose Parquet archive "
            "is confirmed present in Supabase Storage (L18)."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="log intended actions; no DB writes",
    )
    parser.add_argument(
        "--keep-quarters",
        type=int,
        default=_DEFAULT_KEEP_QUARTERS,
        help=f"number of most-recent distinct quarters to retain (default: {_DEFAULT_KEEP_QUARTERS})",
    )
    parser.add_argument(
        "--cik",
        type=str,
        default=None,
        help="restrict prune to a single CIK (default: all CIKs in funds.yaml)",
    )
    args = parser.parse_args(argv)

    # --- GATES (full no-op when env is missing) ---
    if not database_url():
        print("[prune_holdings] SKIP: DATABASE_URL not set")
        return 0

    storage_url, storage_key = supabase_storage()
    if not storage_url or not storage_key:
        print("[prune_holdings] SKIP: SUPABASE_URL or SUPABASE_SECRET_KEY not set")
        return 0

    bucket = sec_parquet_bucket()

    funds = load_funds()
    if args.cik:
        funds = [f for f in funds if f.cik == args.cik]
        if not funds:
            print(f"[prune_holdings] SKIP: CIK {args.cik!r} not found in funds.yaml")
            return 0

    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    pruned_periods = 0
    skipped_periods = 0
    total_holdings_deleted = 0

    try:
        print(
            f"[prune_holdings] keep_quarters={args.keep_quarters}"
            f" cik_filter={args.cik!r} dry_run={args.dry_run}"
        )

        for fund in funds:
            cik = fund.cik
            all_periods = sec_db_sink.read_all_periods(conn, cik)

            if not all_periods:
                print(f"  SKIP {fund.label} ({cik}): no periods in DB")
                continue

            candidates = holdings_prune_periods(all_periods, args.keep_quarters)

            if not candidates:
                print(
                    f"  SKIP {fund.label} ({cik}): only {len(all_periods)} period(s)"
                    f" — all within keep window"
                )
                continue

            print(
                f"  {fund.label} ({cik}): {len(all_periods)} total periods,"
                f" {len(candidates)} candidate(s) for prune"
            )

            for period in candidates:
                period_year = period.year
                archived = _archive_confirmed(
                    storage_url, storage_key, bucket, cik, period_year
                )

                if not archived:
                    print(
                        f"    SKIP ({cik}, {period}): parquet"
                        f" {_parquet_object_path(cik, period_year)}"
                        f" NOT found in Storage — archive incomplete, NOT pruning"
                    )
                    skipped_periods += 1
                    continue

                if args.dry_run:
                    print(
                        f"    DRY-RUN ({cik}, {period}): WOULD hard-delete"
                        f" [archive confirmed at {_parquet_object_path(cik, period_year)}]"
                    )
                    pruned_periods += 1
                    continue

                n_h, n_f = sec_db_sink.prune_period(conn, cik, period)
                conn.commit()
                print(
                    f"    PRUNED ({cik}, {period}): deleted {n_h} holdings"
                    f" + {n_f} filings"
                )
                pruned_periods += 1
                total_holdings_deleted += n_h

        descr = (
            f"keep_quarters={args.keep_quarters}|pruned={pruned_periods}"
            f"|skipped={skipped_periods}|total_holdings_deleted={total_holdings_deleted}"
            f"|dry_run={int(args.dry_run)}"
        )
        print(f"[prune_holdings] {descr}")

    except Exception as exc:  # noqa: BLE001 — record failure, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[prune_holdings] FAILED {descr}")
        raise

    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-prune-sec",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
