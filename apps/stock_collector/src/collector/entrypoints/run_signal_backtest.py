"""Entrypoint: event-study signal backtest (Phase R).

Flow:
  1. read_signal_events(conn, since, limit) — read all event tuples from DB.
  2. For each event: read_returns_window(conn, ticker, event_date, buffer) — fetch
     up to (max_horizon + 4) bars of forward price data.
  3. cumulative_abnormal_return(event_date, series, horizons) — pure transform.
  4. directional_hit(car, direction) — pure transform (per horizon).
  5. Collect SignalBacktestRow observations (all horizons per event).
  6. upsert_signal_backtest(conn, rows) — write observations (skip on --dry-run).
  7. insert_batch_log() — always in finally.

Guardrail log (always printed):
  events_scanned          — total events read from DB
  tickers_missing_price   — events with no market_history bars at all
  skipped_insufficient    — horizon-level None results (price data too short)
  observations_computed   — signal_backtest rows built (upserted unless --dry-run)

--dry-run: read + compute + print guardrails; NO DB writes.
--sector-neutral: subtract cap-weighted sector index return (Phase S).
  When ON, per event the ticker's sector is resolved and a sector benchmark
  series is built and passed to cumulative_abnormal_return as benchmark_series.
  If the sector is unknown or the index is unbuildable, falls back to raw CAR
  silently — never crashes.

Zero new collection: reads only existing tables (market_history, politician_trades,
  v_sec_position_delta, security_map, sec_filings, symbol_fundamentals). No
  yfinance / SEC API calls.
Re-run idempotent: upsert ON CONFLICT DO UPDATE.
A ticker with no market_history is skipped (counted in tickers_missing_price),
never crashes.

Side effects: DB reads always; DB writes only in non-dry-run mode.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import database_url
from collector.schema.rows import SignalBacktestRow
from collector.sink import db_sink
from collector.transform.event_study import (
    cumulative_abnormal_return,
    directional_hit,
    event_window_start,
)
from collector.transform.sector_benchmark import SectorMember, build_sector_index

_HORIZONS = (1, 5, 21)
_MAX_HORIZON = max(_HORIZONS)
_PRICE_FETCH_BUFFER = _MAX_HORIZON + 4   # extra bars for weekend/holiday gaps
_DEFAULT_SINCE = date(2020, 1, 1)
_DEFAULT_LIMIT = 5000


def _print_guardrails(
    *,
    events_scanned: int,
    tickers_missing_price: int,
    skipped_insufficient: int,
    observations_computed: int,
) -> None:
    print(
        f"[run_signal_backtest]"
        f" events_scanned={events_scanned}"
        f" tickers_missing_price={tickers_missing_price}"
        f" skipped_insufficient={skipped_insufficient}"
        f" observations_computed={observations_computed}"
    )


def _build_observation_rows(
    signal_type: str,
    ticker: str,
    event_date: date,
    direction: str,
    price_series: list[tuple[date, float]],
    benchmark_series: list[tuple[date, float]] | None = None,
) -> tuple[list[SignalBacktestRow], int]:
    """Build SignalBacktestRow list for all horizons; return (rows, skipped_count).

    ``skipped_count`` counts horizons that returned None (insufficient bars).
    Pure computation delegated to event_study transforms.
    """
    cars = cumulative_abnormal_return(
        event_date, price_series, horizons=_HORIZONS, benchmark_series=benchmark_series
    )
    rows: list[SignalBacktestRow] = []
    skipped = 0

    for h in _HORIZONS:
        car = cars.get(h)
        if car is None:
            skipped += 1
            # Still write a None-car row so the observation is recorded (not silently dropped).
            rows.append(
                SignalBacktestRow(
                    signal_type=signal_type,
                    ticker=ticker,
                    as_of=event_date,
                    horizon_days=h,
                    car=None,
                    is_hit=None,
                )
            )
        else:
            rows.append(
                SignalBacktestRow(
                    signal_type=signal_type,
                    ticker=ticker,
                    as_of=event_date,
                    horizon_days=h,
                    car=car,
                    is_hit=directional_hit(car, direction),
                )
            )

    return rows, skipped


def _resolve_benchmark(
    conn: "psycopg.Connection",  # type: ignore[name-defined]  # noqa: F821
    ticker: str,
    event_date: date,
) -> list[tuple[date, float]] | None:
    """Resolve cap-weighted sector benchmark series for ``ticker``'s event.

    Returns None when the sector is unknown or the index is unbuildable — the
    caller falls back to raw CAR.  Never raises.
    """
    try:
        sector = db_sink.read_symbol_sector(conn, ticker)
        if not sector:
            return None
        members_raw = db_sink.read_sector_members(conn, sector, event_date, _PRICE_FETCH_BUFFER)
        if not members_raw:
            return None
        gate = event_window_start(event_date)
        members = [SectorMember(sh, prices) for sh, prices in members_raw.values()]
        series = build_sector_index(members, gate, _PRICE_FETCH_BUFFER)
        return series if series else None
    except Exception as exc:  # noqa: BLE001 — benchmark is best-effort; never crash the job
        print(f"[run_signal_backtest] sector benchmark skipped for {ticker}: {exc}")
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compute forward-return signal backtest observations (Phase R)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="read + compute + print guardrails; no DB writes",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=_DEFAULT_LIMIT,
        metavar="N",
        help=f"per-source event limit (default: {_DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        default=_DEFAULT_SINCE,
        metavar="YYYY-MM-DD",
        help=f"earliest event date (default: {_DEFAULT_SINCE})",
    )
    parser.add_argument(
        "--sector-neutral",
        action="store_true",
        help="subtract cap-weighted sector index return (Phase S abnormal return)",
    )
    parser.add_argument(
        "--refresh-13f",
        action="store_true",
        help="REFRESH mv_sec_new_positions before reading (Phase R.6, slow)",
    )
    args = parser.parse_args(argv)

    if not database_url():
        print("[run_signal_backtest] ERROR: DATABASE_URL / POSTGRES_URL_NON_POOLING not set")
        return 1

    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    events_scanned = 0
    tickers_missing_price = 0
    skipped_insufficient = 0
    observations_written = 0

    try:
        if args.refresh_13f:
            print("[run_signal_backtest] refreshing mv_sec_new_positions (13F) …")
            ok = db_sink.refresh_new_positions(conn)
            print(f"[run_signal_backtest] 13F refresh {'ok' if ok else 'skipped'}")

        print(
            f"[run_signal_backtest] reading events since={args.since} limit={args.limit}"
            f" sector_neutral={args.sector_neutral} …"
        )
        events = db_sink.read_signal_events(conn, since=args.since, limit=args.limit)
        events_scanned = len(events)
        print(f"[run_signal_backtest] {events_scanned} events loaded")

        all_rows: list[SignalBacktestRow] = []

        for signal_type, ticker, event_date, direction in events:
            price_series = db_sink.read_returns_window(
                conn, ticker, event_date, _PRICE_FETCH_BUFFER
            )
            if not price_series:
                tickers_missing_price += 1
                continue

            benchmark_series = (
                _resolve_benchmark(conn, ticker, event_date) if args.sector_neutral else None
            )

            obs_rows, skipped = _build_observation_rows(
                signal_type, ticker, event_date, direction, price_series, benchmark_series
            )
            skipped_insufficient += skipped
            all_rows.extend(obs_rows)

        _print_guardrails(
            events_scanned=events_scanned,
            tickers_missing_price=tickers_missing_price,
            skipped_insufficient=skipped_insufficient,
            observations_computed=len(all_rows),
        )

        if args.dry_run:
            print(
                f"[run_signal_backtest] dry-run: {len(all_rows)} observations computed, "
                f"skipping DB writes"
            )
            return 0

        # --- live write path --------------------------------------------------
        observations_written = db_sink.upsert_signal_backtest(conn, all_rows)
        print(f"[run_signal_backtest] upserted {observations_written} observation rows")

        descr = (
            f"events_scanned={events_scanned}"
            f" tickers_missing_price={tickers_missing_price}"
            f" skipped_insufficient={skipped_insufficient}"
            f" observations_written={observations_written}"
        )

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_signal_backtest] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="run-signal-backtest",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
