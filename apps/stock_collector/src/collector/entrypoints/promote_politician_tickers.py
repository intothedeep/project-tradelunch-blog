"""Entrypoint: promote top-N most-politician-traded equity tickers to tracked_symbols.

Flow: read top tickers from politician_trades (by distinct-politician breadth) ->
build exclude-set (watchlist symbols/labels + existing tracked symbols/labels) ->
pure-select (validity filter + dedupe + top-75 cap) ->
(--dry-run) print would-add list and counts with NO writes /
(live)      upsert_tracked_symbols (STICKY — only adds, never removes).

Guardrail logging (in batch_log descr):
  candidates_considered, already_tracked_skipped, invalid_skipped, promoted.

--dry-run: reads DB but writes nothing; prints the candidate list and stats.
Without DATABASE_URL the run prints a warning and exits 0 (can't connect).
workflow_dispatch defaults dry_run=true for safety.

Side effects: DB reads always (when DATABASE_URL set); DB writes only in live mode;
batch_log insert in both modes (best-effort).
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.config.watchlist_loader import load_watchlist
from collector.sink import db_sink
from collector.transform.politician_promote import (
    PoliticianTickerRow,
    select_politician_tickers,
)

JOB_NAME = "promote-politician-tickers"


def _build_exclude(watchlist_entries, tracked_rows) -> frozenset[str]:
    """Build unified exclude set: all watchlist + tracked symbols AND labels.

    Since promoted rows use label=ticker=symbol, one frozenset guards both
    the symbol uniqueness and the UNIQUE label constraint in tracked_symbols.
    """
    exclude: set[str] = set()
    for e in watchlist_entries:
        exclude.add(e.symbol)
        exclude.add(e.label)
    for t in tracked_rows:
        exclude.add(t.symbol)
        exclude.add(t.label)
    return frozenset(exclude)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Promote top politician-traded tickers to tracked_symbols (Phase Q8)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="read DB + compute selection but write nothing; print would-add list",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="SQL LIMIT cap on politician_trades GROUP BY query (0 = fetch all)",
    )
    args = parser.parse_args(argv)

    if not database_url():
        print(
            f"[{JOB_NAME}] ERROR: DATABASE_URL not set — cannot connect to DB. Exiting."
        )
        return 1

    watchlist = load_watchlist()
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    try:
        raw_rows = db_sink.read_top_politician_tickers(conn, args.limit)
        print(
            f"[{JOB_NAME}] fetched {len(raw_rows)} distinct equity tickers "
            "from politician_trades"
        )

        tracked = db_sink.read_tracked_symbols(conn)
        exclude = _build_exclude(watchlist, tracked)
        print(
            f"[{JOB_NAME}] exclude-set size={len(exclude)} "
            f"(watchlist_entries={len(watchlist)} tracked_rows={len(tracked)})"
        )

        ticker_rows = [
            PoliticianTickerRow(ticker=t, distinct_filers=df, trade_count=tc)
            for t, df, tc in raw_rows
        ]

        promoted_rows, stats = select_politician_tickers(ticker_rows, exclude)

        descr = (
            f"candidates_considered={stats['candidates_considered']}"
            f"|already_tracked_skipped={stats['already_tracked_skipped']}"
            f"|invalid_skipped={stats['invalid_skipped']}"
            f"|promoted={stats['promoted']}"
        )
        print(f"[{JOB_NAME}] {descr}")

        if args.dry_run:
            print(
                f"[{JOB_NAME}] dry-run: would promote {len(promoted_rows)} tickers "
                "(no writes):"
            )
            for r in promoted_rows:
                print(f"  {r.symbol}")
        else:
            now = datetime.now(timezone.utc)
            n_upserted = db_sink.upsert_tracked_symbols(conn, promoted_rows, now)
            print(
                f"[{JOB_NAME}] upserted {n_upserted} rows into tracked_symbols"
            )

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[{JOB_NAME}] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job=JOB_NAME,
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
