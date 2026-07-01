"""Entrypoint: retention prune — delete market_history bars archived to Parquet.

Purpose: remove old OHLC bars from Postgres once the corresponding Parquet
objects are confirmed present in Supabase Storage. Guards (all must pass):
  1. DATABASE_URL set
  2. SHOULD_COLLECTOR_ARCHIVE_MARKET_PARQUET=true (Parquet archive enabled)
  3. SUPABASE_URL + SUPABASE_SECRET_KEY set

Flow (layer direction entrypoints -> config|transform -> sink):
  compute cutoff (prune_cutoff) -> connect DB -> build label->ticker map from
  universe -> read_prune_candidates (bars < cutoff) -> per label: prunable_years
  -> verify each year's Parquet object_exists -> if ALL present: delete_history_before
  + commit; else SKIP -> insert_batch_log.

Invariants:
  - ``today`` is read ONCE at the IO boundary (main entry), then passed as value.
  - No label is deleted unless ALL prunable Parquet objects are confirmed present.
  - Labels with no universe entry (label not in label->ticker map) are skipped
    (no delete, no error). A label→ticker map miss means we cannot confirm the
    archive path, so we never risk data loss.
  - ``--dry-run`` prints intended actions, no DB writes.
  - Commit is per-label (partial progress survives interruption).

Side effects: network HEAD (Storage object probes) + DB DELETE (if not dry-run).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import (
    database_url,
    parquet_archive_enabled,
    parquet_bucket,
    supabase_storage,
)
from collector.config.watchlist_loader import load_watchlist
from collector.sink import db_sink
from collector.sink.storage_sink import object_exists
from collector.transform.retention import prune_cutoff, prunable_years
from collector.transform.universe_resolve import resolve_universe
from lib.constants import PROVIDER_YAHOO, safe_symbol


def _build_label_ticker_map(conn) -> dict[str, str]:
    """label -> safe_symbol(entry.symbol) from the resolved universe."""
    tracked = db_sink.read_tracked_symbols(conn)
    universe = resolve_universe(load_watchlist(), tracked)
    return {entry.label: safe_symbol(entry.symbol) for entry in universe}


def _all_objects_exist(
    base_url: str,
    secret_key: str,
    bucket: str,
    ticker: str,
    years: list[int],
) -> tuple[bool, list[int]]:
    """Return (all_present, missing_years). Probe each year's Parquet object."""
    missing = [
        yr for yr in years
        if not object_exists(
            base_url,
            secret_key,
            bucket,
            f"market/{PROVIDER_YAHOO}/{ticker}/{ticker}_{yr}.parquet",
        )
    ]
    return len(missing) == 0, missing


def main(argv: list[str] | None = None) -> int:
    """Prune archived market_history bars confirmed present in Supabase Storage."""
    parser = argparse.ArgumentParser(
        description="Prune market_history bars whose Parquet archive is confirmed."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="log intended actions; no DB writes",
    )
    parser.add_argument(
        "--years",
        type=int,
        default=5,
        help="retention window in years (default: 5)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="cap number of labels processed (0 = all)",
    )
    args = parser.parse_args(argv)

    # --- GATES (full no-op when env is missing) ---
    if not database_url():
        print("[prune_history] SKIP: DATABASE_URL not set")
        return 0

    if not parquet_archive_enabled():
        print("[prune_history] SKIP: SHOULD_COLLECTOR_ARCHIVE_MARKET_PARQUET not enabled")
        return 0

    storage_url, storage_key = supabase_storage()
    if not storage_url or not storage_key:
        print("[prune_history] SKIP: SUPABASE_URL or SUPABASE_SECRET_KEY not set")
        return 0

    bucket = parquet_bucket()

    # today is read ONCE at the IO boundary
    today = date.today()
    cutoff = prune_cutoff(today, args.years)
    started_at = datetime.now(timezone.utc)

    conn = db_sink.connect()
    status, descr = "success", ""

    pruned_labels = 0
    skipped_labels = 0
    total_deleted = 0

    try:
        label_ticker = _build_label_ticker_map(conn)
        candidates = db_sink.read_prune_candidates(conn, cutoff)

        labels = list(candidates.keys())
        if args.limit:
            labels = labels[: args.limit]

        print(
            f"[prune_history] cutoff={cutoff} candidates={len(candidates)}"
            f" processing={len(labels)} dry_run={args.dry_run}"
        )

        for label in labels:
            min_date, bar_count = candidates[label]

            if label not in label_ticker:
                print(f"  SKIP {label!r}: no universe entry (cannot verify archive path)")
                skipped_labels += 1
                continue

            ticker = label_ticker[label]
            years = prunable_years(min_date.year, cutoff)

            if not years:
                print(f"  SKIP {label!r}: no prunable years below cutoff {cutoff}")
                skipped_labels += 1
                continue

            all_present, missing = _all_objects_exist(
                storage_url, storage_key, bucket, ticker, years
            )

            if not all_present:
                print(
                    f"  SKIP {label!r} ({ticker}): missing Parquet year(s) {missing}"
                    f" — archive incomplete, NOT pruning"
                )
                skipped_labels += 1
                continue

            if args.dry_run:
                print(
                    f"  DRY-RUN {label!r} ({ticker}): WOULD delete {bar_count} bars"
                    f" (years {years[0]}–{years[-1]})"
                )
                pruned_labels += 1
                continue

            deleted = db_sink.delete_history_before(conn, label, cutoff)
            conn.commit()
            print(
                f"  PRUNED {label!r} ({ticker}): deleted {deleted} bars"
                f" (years {years[0]}–{years[-1]})"
            )
            pruned_labels += 1
            total_deleted += deleted

        descr = (
            f"cutoff={cutoff}|pruned={pruned_labels}|skipped={skipped_labels}"
            f"|total_deleted={total_deleted}|dry_run={int(args.dry_run)}"
        )
        print(f"[prune_history] {descr}")

    except Exception as exc:  # noqa: BLE001 — record failure, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[prune_history] FAILED {descr}")
        raise

    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-prune",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
