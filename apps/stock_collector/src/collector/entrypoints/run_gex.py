"""Entrypoint: options-chain → Gamma Exposure (GEX) daily pipeline (Phase V-collect).

Flow:
  1. For each ticker:
     a. fetch_spot(provider, ticker)      — current underlying price.
     b. fetch_chain(provider, ticker)     — full options chain as ChainRow list.
     c. aggregate_gex(rows, spot)         — (net_gex, call_gex, put_gex).
     d. Build GexDailyRow(as_of, ticker, net_gex, call_gex, put_gex, spot, source).
  2. upsert_gex_daily(conn, gex_rows)     — skipped on --dry-run.
  3. insert_batch_log(...)                — always in finally.

Guardrails (always printed):
  tickers_attempted   — total tickers in the run
  spot_missing        — tickers where spot fetch returned None (skipped)
  chain_empty         — tickers where chain fetch returned [] (skipped)
  gex_computed        — GexDailyRow observations built
  gex_upserted        — rows written (0 on --dry-run)

--dry-run: fetch + compute + print guardrails; NO DB writes.
--tickers: space-separated list of tickers (default: read from configs/watchlist).
--provider: chain provider key (default: 'yfinance').

Re-run idempotent: ON CONFLICT (as_of, ticker) DO UPDATE.

Side effects: DB writes only in non-dry-run mode; network always.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.schema.chain_rows import GexDailyRow
from collector.sink.chain_provider import PROVIDER_YFINANCE, fetch_chain, fetch_spot
from collector.sink import gex_sink
from collector.transform.gamma import aggregate_gex

_JOB_NAME = "gex_daily"


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch options chain → compute GEX → store.")
    parser.add_argument(
        "--tickers",
        nargs="+",
        metavar="TICKER",
        help="Tickers to process (space-separated). Required.",
    )
    parser.add_argument(
        "--provider",
        default=PROVIDER_YFINANCE,
        help=f"Chain provider key (default: {PROVIDER_YFINANCE!r}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch + compute only; no DB writes.",
    )
    return parser.parse_args(argv)


def _print_guardrails(
    *,
    tickers_attempted: int,
    spot_missing: int,
    chain_empty: int,
    gex_computed: int,
    gex_upserted: int,
    dry_run: bool,
) -> None:
    tag = "[DRY-RUN] " if dry_run else ""
    print(
        f"{tag}run_gex guardrails:\n"
        f"  tickers_attempted : {tickers_attempted}\n"
        f"  spot_missing      : {spot_missing}\n"
        f"  chain_empty       : {chain_empty}\n"
        f"  gex_computed      : {gex_computed}\n"
        f"  gex_upserted      : {gex_upserted}"
    )


def run(argv: list[str] | None = None) -> int:
    """Main entry point; returns exit code (0 success, 1 error)."""
    args = _parse_args(argv)

    if not args.tickers:
        print("[run_gex] --tickers is required", file=sys.stderr)
        return 1

    tickers: list[str] = args.tickers
    provider: str = args.provider
    dry_run: bool = args.dry_run
    as_of: date = date.today()
    started_at = datetime.now(tz=timezone.utc)

    # --- fetch + transform ---------------------------------------------------
    gex_rows: list[GexDailyRow] = []
    spot_missing = 0
    chain_empty = 0

    for ticker in tickers:
        spot = fetch_spot(provider, ticker)
        if spot is None:
            print(f"[run_gex] {ticker}: spot unavailable — skipped")
            spot_missing += 1
            continue

        chain = fetch_chain(provider, ticker)
        if not chain:
            print(f"[run_gex] {ticker}: chain empty — skipped")
            chain_empty += 1
            continue

        net_gex, call_gex, put_gex = aggregate_gex(chain, spot)
        gex_rows.append(
            GexDailyRow(
                as_of=as_of,
                ticker=ticker,
                net_gex=net_gex,
                call_gex=call_gex,
                put_gex=put_gex,
                spot=spot,
                source=provider,
            )
        )
        print(
            f"[run_gex] {ticker}: spot={spot:.2f} "
            f"net_gex={net_gex:,.0f} call={call_gex:,.0f} put={put_gex:,.0f}"
        )

    # --- write ---------------------------------------------------------------
    gex_upserted = 0
    status = "success"
    descr_parts: list[str] = []

    if dry_run:
        descr_parts.append("dry-run; no writes")
    else:
        conn = gex_sink.connect()
        try:
            gex_upserted = gex_sink.upsert_gex_daily(conn, gex_rows)
            descr_parts.append(f"upserted={gex_upserted}")
        except Exception as exc:  # noqa: BLE001
            status = "error"
            descr_parts.append(f"error={exc}")
            print(f"[run_gex] upsert failed: {exc}", file=sys.stderr)
        finally:
            finished_at = datetime.now(tz=timezone.utc)
            descr_parts += [
                f"tickers={len(tickers)}",
                f"computed={len(gex_rows)}",
            ]
            gex_sink.insert_batch_log(
                conn,
                job=_JOB_NAME,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
                descr="; ".join(descr_parts),
            )
            conn.close()

    finished_at = datetime.now(tz=timezone.utc)

    _print_guardrails(
        tickers_attempted=len(tickers),
        spot_missing=spot_missing,
        chain_empty=chain_empty,
        gex_computed=len(gex_rows),
        gex_upserted=gex_upserted,
        dry_run=dry_run,
    )

    return 0 if status == "success" else 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
