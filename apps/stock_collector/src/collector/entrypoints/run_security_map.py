"""Entrypoint: resolve 13F CUSIPs to tickers via OpenFIGI (Phase P, STEP 0-b).

Flow: read the ever-top-N CUSIPs still needing resolution (recent quarters) ->
batch them through OpenFIGI /v3/mapping -> parse -> upsert into security_map ->
cache ticker->sector from symbol_fundamentals. Weekly cadence
(collector-security-map.yml), 1h after the 13F collector so new-quarter CUSIPs
are present. No new quarter -> few/zero candidates -> near no-op.

--dry-run reads + prints the candidate CUSIP count WITHOUT calling OpenFIGI or
writing, so it works with no API key against the current DB. The API key is
optional (keyless is throttled); absence is graceful.

Side effects: network (OpenFIGI) + DB writes in non-dry mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink, figi_fetch, security_map_sink
from collector.transform.cusip_resolve import parse_figi_mapping


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Resolve 13F CUSIPs -> tickers (Phase P)")
    parser.add_argument("--dry-run", action="store_true", help="print candidate count, no OpenFIGI/DB writes")
    parser.add_argument("--limit", type=int, default=0, help="max candidate CUSIPs to resolve (0=all)")
    parser.add_argument("--quarters", type=int, default=8, help="recent quarters window for candidates")
    parser.add_argument("--top-n", type=int, default=50, help="per-(fund,quarter) top-N by value_usd")
    parser.add_argument("--max-attempts", type=int, default=5, help="retry cap for unmappable CUSIPs")
    args = parser.parse_args(argv)

    if not database_url():
        print("[run_security_map] no DATABASE_URL — nothing to do")
        return 0

    conn = db_sink.connect()

    def _candidates() -> list[str]:
        cusips = security_map_sink.select_candidate_cusips(
            conn, quarters=args.quarters, top_n=args.top_n, max_attempts=args.max_attempts
        )
        return cusips[: args.limit] if args.limit else cusips

    # --- dry-run path (no OpenFIGI, no writes) ------------------------------
    if args.dry_run:
        try:
            candidates = _candidates()
            print(
                f"[dry-run] candidates={len(candidates)}"
                f" (quarters={args.quarters}, top_n={args.top_n})"
                f" sample={candidates[:10]}"
            )
        finally:
            conn.close()
        return 0

    # --- live path ----------------------------------------------------------
    started_at = datetime.now(timezone.utc)
    status, descr = "success", ""
    try:
        candidates = _candidates()
        if not candidates:
            descr = "candidates=0 — no-op"
            print(f"[run_security_map] {descr}")
        else:
            sent, results = figi_fetch.fetch_mapping(candidates)
            rows = parse_figi_mapping(sent, results)
            n_written = security_map_sink.upsert_security_map(conn, rows)
            n_sector = security_map_sink.copy_sector_from_fundamentals(conn)
            resolved = sum(1 for r in rows if r.ticker)
            descr = (
                f"candidates={len(candidates)} resolved={resolved}"
                f" written={n_written} sector_cached={n_sector}"
            )
            print(f"[run_security_map] {descr}")
    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_security_map] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn, job="collector-secmap", status=status,
            started_at=started_at, finished_at=datetime.now(timezone.utc), descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
