"""Entrypoint: backfill kadoa congressional-trade history per filer (Phase Q).

Flow:
  1. fetch filers.json -> parse_filers -> upsert_politicians_enriched (once, up front)
  2. For each filer id:
       fetch filer/{id}.json -> parse_trades(trades[]) -> upsert_politicians (basic)
       -> commit -> upsert_trades -> commit
  Per-filer failures are isolated: one bad filer file logs + increments filer_failures
  and continues; it does NOT abort the run.

Guardrail metrics logged at end:
  filers_visited, rows_fetched, rows_parsed, rows_upserted, filer_failures

--dry-run: fetch + parse + print per-filer counts; NO DB writes.
--limit N: process only the first N filers (for smoke tests).

try/finally: insert_batch_log(job='backfill-politician-trades') always runs in live mode.

Foreign-key invariant: politician_registry must exist before politician_trades in each
filer batch. The up-front upsert_politicians_enriched plus per-filer upsert_politicians
guarantee this even when the enrichment step covers all known filers.

Side effects: network (kadoa) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.sink.kadoa_fetch import fetch_filer_detail, fetch_filers
from collector.sink.politician_db_sink import (
    upsert_politicians,
    upsert_politicians_enriched,
    upsert_trades,
)
from collector.transform.politician_parse import parse_filers, parse_trades


# ---------------------------------------------------------------------------
# Per-filer processing (dry-run and live share the parse path)
# ---------------------------------------------------------------------------


def _process_filer_dry(filer_id: str) -> tuple[int, int]:
    """Fetch + parse one filer; return (rows_fetched, rows_parsed). No writes.

    Returns (0, 0) on any fetch/parse failure (caller handles failures via
    the wrapping try/except in the main loop).
    """
    detail = fetch_filer_detail(filer_id)
    trades_raw = detail.get("trades") or []
    rows_fetched = len(trades_raw)
    trade_rows, _ = parse_trades(trades_raw)
    return rows_fetched, len(trade_rows)


def _process_filer_live(
    conn,
    filer_id: str,
) -> tuple[int, int]:
    """Fetch + parse + upsert one filer. Returns (rows_fetched, rows_upserted).

    FK order: upsert_politicians (basic) committed before upsert_trades.
    Caller must NOT commit before calling — this function owns its commits.
    """
    detail = fetch_filer_detail(filer_id)
    trades_raw = detail.get("trades") or []
    rows_fetched = len(trades_raw)

    trade_rows, registry_rows = parse_trades(trades_raw)

    # Ensure registry row exists (non-clobbering; enriched cols written up front).
    upsert_politicians(conn, registry_rows)
    conn.commit()

    rows_upserted = upsert_trades(conn, trade_rows)
    conn.commit()

    return rows_fetched, rows_upserted


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Backfill kadoa congressional-trade history per filer (Phase Q)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch+parse+print counts only; no DB writes",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="process only the first N filers (smoke test / partial backfill)",
    )
    args = parser.parse_args(argv)

    # --- dry-run path (no DB) -----------------------------------------------
    if args.dry_run or not database_url():
        print("[backfill_politician_trades] dry-run: fetching filers.json …")
        filer_records = fetch_filers()
        filer_rows = parse_filers(filer_records)
        filers_to_process = filer_rows[: args.limit] if args.limit else filer_rows
        print(
            f"[backfill_politician_trades] filers_total={len(filer_rows)}"
            f" filers_to_process={len(filers_to_process)}"
        )

        total_fetched = 0
        total_parsed = 0
        filer_failures = 0

        for row in filers_to_process:
            filer_id = row.filer_id
            try:
                fetched, parsed = _process_filer_dry(filer_id)
                total_fetched += fetched
                total_parsed += parsed
                print(
                    f"  [dry-run] filer={filer_id}"
                    f" rows_fetched={fetched}"
                    f" rows_parsed={parsed}"
                )
            except Exception as exc:  # noqa: BLE001
                filer_failures += 1
                print(
                    f"  [dry-run] filer={filer_id} FAILED"
                    f" ({type(exc).__name__}: {exc}) — continuing"
                )

        print(
            f"[dry-run] filers_visited={len(filers_to_process)}"
            f" rows_fetched={total_fetched}"
            f" rows_parsed={total_parsed}"
            f" rows_upserted=0 (dry-run)"
            f" filer_failures={filer_failures}"
        )
        return 0

    # --- live path ----------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    filers_visited = 0
    total_fetched = 0
    total_upserted = 0
    filer_failures = 0

    try:
        # Step 1: enrich full registry from filers.json (once, up front).
        print("[backfill_politician_trades] fetching filers.json …")
        filer_records = fetch_filers()
        filer_rows = parse_filers(filer_records)
        filers_to_process = filer_rows[: args.limit] if args.limit else filer_rows
        print(
            f"[backfill_politician_trades] filers_total={len(filer_rows)}"
            f" filers_to_process={len(filers_to_process)}"
        )

        n_enriched = upsert_politicians_enriched(conn, filer_rows)
        conn.commit()
        print(
            f"[backfill_politician_trades] enriched {n_enriched} registry rows"
        )

        # Step 2: per-filer detail fetch + trades upsert.
        for row in filers_to_process:
            filer_id = row.filer_id
            filers_visited += 1
            try:
                fetched, upserted = _process_filer_live(conn, filer_id)
                total_fetched += fetched
                total_upserted += upserted
                print(
                    f"  filer={filer_id}"
                    f" rows_fetched={fetched}"
                    f" rows_upserted={upserted}"
                )
            except Exception as exc:  # noqa: BLE001
                filer_failures += 1
                print(
                    f"  filer={filer_id} FAILED"
                    f" ({type(exc).__name__}: {exc}) — continuing"
                )

        descr = (
            f"filers_visited={filers_visited}"
            f" rows_fetched={total_fetched}"
            f" rows_upserted={total_upserted}"
            f" filer_failures={filer_failures}"
        )
        if filer_failures:
            status = "partial"
        print(f"[backfill_politician_trades] done: {descr}")

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[backfill_politician_trades] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="backfill-politician-trades",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
