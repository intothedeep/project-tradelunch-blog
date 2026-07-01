"""Entrypoint: log retention TTL prune (Phase N) — hard-DELETE aged log rows.

Purpose: enforce a rolling time-to-live on the two operational log tables,
error_log and batch_log. Both carry an owner-approved no-tombstone exception
(migrations 0014 / 0015), so this is a sanctioned hard-delete with NO Parquet
archive precondition (unlike the OHLC / 13F prune paths). Single gate:
DATABASE_URL.

Flow (entrypoints -> config|transform -> sink):
  read ``now`` ONCE -> per target: age_cutoff(now, days) ->
  (dry-run: COUNT) | (live: delete_*_before + commit) ->
  insert_batch_log(job=collector-prune-logs).

Policy:
  - error_log: default 7-day TTL (matches the retired error_log_cleanup pg_cron).
  - batch_log: default 90-day TTL; rows with resolved=0 (open failures) are
    RETAINED at any age unless --no-keep-open-failures is passed.

Invariants:
  - ``now`` is read ONCE at the IO boundary, then passed as a value.
  - ``--dry-run`` counts candidates, no DB writes.
  - Commit is per target (partial progress survives interruption).

Side effects: DB DELETE (if not dry-run) + one batch_log row.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.transform.retention import age_cutoff

_TARGETS = ("error_log", "batch_log", "all")


def main(argv: list[str] | None = None) -> int:
    """TTL-prune aged error_log / batch_log rows (sanctioned no-archive hard-delete)."""
    parser = argparse.ArgumentParser(
        description="TTL-prune aged error_log / batch_log rows (no archive)."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="count candidates; no DB writes"
    )
    parser.add_argument(
        "--target",
        choices=_TARGETS,
        default="all",
        help="which log table to prune (default: all)",
    )
    parser.add_argument(
        "--error-days", type=int, default=7, help="error_log TTL in days (default: 7)"
    )
    parser.add_argument(
        "--batch-days", type=int, default=90, help="batch_log TTL in days (default: 90)"
    )
    parser.add_argument(
        "--keep-open-failures",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="retain batch_log rows with resolved=0 regardless of age (default: on)",
    )
    args = parser.parse_args(argv)

    # --- GATE (full no-op when env is missing) ---
    if not database_url():
        print("[prune_logs] SKIP: DATABASE_URL not set")
        return 0

    now = datetime.now(timezone.utc)  # read ONCE at the IO boundary
    started_at = now

    do_error = args.target in ("error_log", "all")
    do_batch = args.target in ("batch_log", "all")

    conn = db_sink.connect()
    status, descr = "success", ""
    error_deleted = batch_deleted = 0

    try:
        if do_error:
            cutoff = age_cutoff(now, args.error_days)
            if args.dry_run:
                n = db_sink.count_error_log_before(conn, cutoff)
                print(f"  DRY-RUN error_log: WOULD delete {n} rows < {cutoff.isoformat()}")
            else:
                error_deleted = db_sink.delete_error_log_before(conn, cutoff)
                conn.commit()
                print(
                    f"  PRUNED error_log: deleted {error_deleted} rows < {cutoff.isoformat()}"
                )

        if do_batch:
            cutoff = age_cutoff(now, args.batch_days)
            keep = args.keep_open_failures
            if args.dry_run:
                n = db_sink.count_batch_log_before(conn, cutoff, keep_open_failures=keep)
                print(
                    f"  DRY-RUN batch_log: WOULD delete {n} rows < {cutoff.isoformat()}"
                    f" (keep_open_failures={int(keep)})"
                )
            else:
                batch_deleted = db_sink.delete_batch_log_before(
                    conn, cutoff, keep_open_failures=keep
                )
                conn.commit()
                print(
                    f"  PRUNED batch_log: deleted {batch_deleted} rows < {cutoff.isoformat()}"
                    f" (keep_open_failures={int(keep)})"
                )

        descr = (
            f"target={args.target}|error_days={args.error_days}|batch_days={args.batch_days}"
            f"|error_deleted={error_deleted}|batch_deleted={batch_deleted}"
            f"|dry_run={int(args.dry_run)}"
        )
        print(f"[prune_logs] {descr}")

    except Exception as exc:  # noqa: BLE001 — record failure, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[prune_logs] FAILED {descr}")
        raise

    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-prune-logs",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
