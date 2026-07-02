"""Entrypoint: daily kadoa congressional-trade disclosure collector (Phase Q).

Flow: fetch kadoa trades.json -> parse -> upsert_politicians -> commit ->
[best-effort] fetch filers.json -> parse_filers -> upsert_politicians_enriched -> commit ->
upsert_trades -> commit; try/finally insert_batch_log.

The filers enrichment step is best-effort: if fetch_filers or upsert_politicians_enriched
fails, a WARNING is logged and the run continues — trades ingest succeeds and exits 0.
The enrichment never clobbers basic columns set by the trades path because
upsert_politicians_enriched uses a separate SQL that owns the aggregate columns.

Guardrail logging:
  * rows_ingested       — total trade rows upserted
  * distinct_filers     — unique filer_id count in this batch
  * unresolved_ticker_pct — % of trades with ticker=None
  * feed_staleness_days — today - max(disclosure_date) in parsed batch

--dry-run: fetch + parse + print counts only; NO DB writes.

Partial-failure: parse/fetch errors set status='failed' and re-raise after
the finally block (batch_log still lands). Individual record errors are
swallowed inside parse_trades (records with no id/filing_date are skipped).

Side effects: network (kadoa) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.sink.kadoa_fetch import fetch_filers, fetch_trades
from collector.sink.politician_db_sink import (
    upsert_politicians,
    upsert_politicians_enriched,
    upsert_trades,
)
from collector.transform.politician_parse import parse_filers, parse_trades


def _guardrail_stats(
    trade_rows,
    registry_rows,
) -> tuple[int, int, float, int | None]:
    """Compute guardrail metrics from parsed rows.

    Returns:
        (rows_ingested, distinct_filers, unresolved_ticker_pct, feed_staleness_days)
    """
    rows_ingested = len(trade_rows)
    distinct_filers = len(registry_rows)

    unresolved = sum(1 for t in trade_rows if t.ticker is None)
    unresolved_pct = round(unresolved / rows_ingested * 100, 1) if rows_ingested else 0.0

    if trade_rows:
        max_disc = max(t.disclosure_date for t in trade_rows)
        staleness = (date.today() - max_disc).days
    else:
        staleness = None

    return rows_ingested, distinct_filers, unresolved_pct, staleness


def _enrich_registry_best_effort(conn) -> None:
    """Fetch filers.json and upsert aggregate columns. Non-fatal on any error."""
    try:
        filer_records = fetch_filers()
        enriched_rows = parse_filers(filer_records)
        n = upsert_politicians_enriched(conn, enriched_rows)
        conn.commit()
        print(f"[run_politician_trades] enriched {n} registry rows from filers.json")
    except Exception as exc:  # noqa: BLE001
        print(
            f"[run_politician_trades] WARNING: filers enrichment failed (non-fatal): "
            f"{type(exc).__name__}: {exc}"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Daily kadoa congressional-trade collector (Phase Q)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch+parse+print counts only; no DB writes",
    )
    args = parser.parse_args(argv)

    # --- dry-run path (no DB) -----------------------------------------------
    if args.dry_run or not database_url():
        print("[run_politician_trades] dry-run: fetching kadoa trades.json …")
        records, _ = fetch_trades()
        trade_rows, registry_rows = parse_trades(records)
        rows_ingested, distinct_filers, unresolved_pct, staleness = _guardrail_stats(
            trade_rows, registry_rows
        )
        print(
            f"[dry-run] records_fetched={len(records)}"
            f" rows_parsed={rows_ingested}"
            f" distinct_filers={distinct_filers}"
            f" unresolved_ticker_pct={unresolved_pct}%"
            f" feed_staleness_days={staleness}"
        )
        return 0

    # --- live path ----------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    try:
        print("[run_politician_trades] fetching kadoa trades.json …")
        records, _ = fetch_trades()
        print(f"[run_politician_trades] fetched {len(records)} records")

        trade_rows, registry_rows = parse_trades(records)
        rows_ingested, distinct_filers, unresolved_pct, staleness = _guardrail_stats(
            trade_rows, registry_rows
        )

        # FK order: registry first, then enrichment, then trades.
        n_politicians = upsert_politicians(conn, registry_rows)
        conn.commit()

        # Best-effort filers enrichment (non-fatal; trades ingest proceeds regardless).
        _enrich_registry_best_effort(conn)

        n_trades = upsert_trades(conn, trade_rows)
        conn.commit()

        descr = (
            f"rows_ingested={n_trades}"
            f" distinct_filers={n_politicians}"
            f" unresolved_ticker_pct={unresolved_pct}%"
            f" feed_staleness_days={staleness}"
        )
        print(f"[run_politician_trades] {descr}")

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_politician_trades] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-politician-trades",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
