"""Entrypoint: politician-disclosure → price lead-lag analysis (Phase T).

Flow:
  1. read_signal_events(conn, since, limit) — load event tuples from DB.
  2. Filter to --signal-type when specified (default: analyse all types).
  3. For each event: read_returns_window(conn, ticker, event_date, buffer) —
     fetch the next (max_lag + buffer) bars of price data.
  4. Compute 1-bar forward return per event (entry = first bar after event_date,
     exit = next bar). Events with no usable price data are counted and skipped.
  5. Aggregate per calendar day: intensity = event count, mean_return = mean(returns).
  6. build_aligned_series → inner-join on date → parallel (x, y) lists.
  7. lagged_cross_correlation(x, y, range(1, max_lag+1)).
  8. Print a per-lag correlation table + optimal lag per signal type.
  9. insert_batch_log() in finally (analysis-only: NO other DB writes).

Guardrails printed per signal type:
  events_filtered   — events kept after signal-type filter
  no_price_skipped  — events where read_returns_window returned nothing
  no_return_skipped — events where 1-bar return was uncomputable (entry=0 etc.)
  aligned_dates     — date points that entered the correlation computation

--dry-run is not needed: this entrypoint never writes domain data.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date, datetime, timezone

from collector.config.settings import database_url
from collector.sink import db_sink
from collector.transform.lead_lag import (
    build_aligned_series,
    lagged_cross_correlation,
    optimal_lag,
)

_DEFAULT_SINCE = date(2020, 1, 1)
_DEFAULT_LIMIT = 5000
_DEFAULT_MAX_LAG = 10
_PRICE_FETCH_EXTRA = 5  # extra bars beyond max_lag to absorb weekend/holiday gaps


def _one_bar_return(
    event_date: date,
    price_series: list[tuple[date, float]],
) -> float | None:
    """1-bar forward return: entry = first bar after event_date, exit = next bar.

    Returns None when fewer than 2 bars exist strictly after event_date or
    when the entry price is zero (division guard).
    """
    bars_after = [(d, c) for d, c in price_series if d > event_date]
    if len(bars_after) < 2:
        return None
    entry = bars_after[0][1]
    exit_price = bars_after[1][1]
    if entry == 0.0:
        return None
    return (exit_price - entry) / entry


def _aggregate_events(
    events: list[tuple[str, str, date, str]],
    signal_type: str,
    conn: object,
    price_buffer: int,
) -> tuple[dict[date, int], dict[date, float], int, int]:
    """Aggregate events for one signal_type into per-date dicts.

    Returns:
        intensity     — {date: event_count}
        mean_return   — {date: mean_1bar_return} (only dates with ≥1 valid return)
        no_price_skip — count of events with no market_history bars at all
        no_ret_skip   — count of events where the return was uncomputable
    """
    intensity: dict[date, int] = defaultdict(int)
    returns_by_date: dict[date, list[float]] = defaultdict(list)
    no_price_skip = 0
    no_ret_skip = 0

    for sig, ticker, event_date, _direction in events:
        if sig != signal_type:
            continue

        intensity[event_date] += 1

        price_series = db_sink.read_returns_window(  # type: ignore[arg-type]
            conn, ticker, event_date, price_buffer
        )
        if not price_series:
            no_price_skip += 1
            continue

        ret = _one_bar_return(event_date, price_series)
        if ret is None:
            no_ret_skip += 1
            continue

        returns_by_date[event_date].append(ret)

    mean_return: dict[date, float] = {
        d: sum(rs) / len(rs)
        for d, rs in returns_by_date.items()
        if rs
    }

    return dict(intensity), mean_return, no_price_skip, no_ret_skip


def _print_lag_table(
    signal_type: str,
    corr_by_lag: dict[int, float],
    opt_l: int,
    opt_c: float,
    aligned_dates: int,
) -> None:
    """Print per-lag correlation table and optimal lag to stdout."""
    print(f"\n[run_lead_lag] signal_type={signal_type}  aligned_dates={aligned_dates}")
    print(f"  {'lag':>4}  {'pearson_r':>10}")
    print(f"  {'-' * 4:>4}  {'-' * 10:>10}")
    for lag in sorted(corr_by_lag):
        marker = "  <- optimal" if lag == opt_l else ""
        print(f"  {lag:>4}  {corr_by_lag[lag]:>10.4f}{marker}")
    print(f"\n  optimal_lag={opt_l}  pearson_r={opt_c:.4f}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Politician-disclosure → price lead-lag analysis (Phase T)."
    )
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        default=_DEFAULT_SINCE,
        metavar="YYYY-MM-DD",
        help=f"earliest event date inclusive (default: {_DEFAULT_SINCE})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=_DEFAULT_LIMIT,
        metavar="N",
        help=f"per-source SQL LIMIT on events (default: {_DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--signal-type",
        default=None,
        metavar="TYPE",
        help="restrict analysis to one signal type e.g. 'politician_buy' (default: all)",
    )
    parser.add_argument(
        "--max-lag",
        type=int,
        default=_DEFAULT_MAX_LAG,
        metavar="L",
        help=f"maximum lag to evaluate in trading days (default: {_DEFAULT_MAX_LAG})",
    )
    args = parser.parse_args(argv)

    if not database_url():
        print("[run_lead_lag] ERROR: DATABASE_URL / POSTGRES_URL_NON_POOLING not set")
        return 1

    started_at = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""

    try:
        price_buffer = args.max_lag + _PRICE_FETCH_EXTRA
        lags = list(range(1, args.max_lag + 1))

        print(
            f"[run_lead_lag] since={args.since} limit={args.limit}"
            f" signal_type={args.signal_type or 'all'} max_lag={args.max_lag} …"
        )
        events = db_sink.read_signal_events(conn, since=args.since, limit=args.limit)
        print(f"[run_lead_lag] {len(events)} events loaded")

        # Determine signal types to analyse.
        if args.signal_type:
            signal_types = [args.signal_type]
        else:
            seen: set[str] = set()
            signal_types = []
            for sig, *_ in events:
                if sig not in seen:
                    seen.add(sig)
                    signal_types.append(sig)

        results_summary: list[str] = []

        for sig_type in signal_types:
            events_filtered = sum(1 for s, *_ in events if s == sig_type)

            intensity, mean_return, no_price_skip, no_ret_skip = _aggregate_events(
                events, sig_type, conn, price_buffer
            )

            print(
                f"[run_lead_lag] {sig_type}"
                f"  events_filtered={events_filtered}"
                f"  no_price_skipped={no_price_skip}"
                f"  no_return_skipped={no_ret_skip}"
            )

            if not intensity:
                print(f"[run_lead_lag] {sig_type}: 0 events — skipped")
                continue

            x, y = build_aligned_series(intensity, mean_return)
            n_dates = len(x)

            if n_dates < 2:
                print(
                    f"[run_lead_lag] {sig_type}: only {n_dates} aligned date(s) — "
                    "need ≥2 to compute correlation; skipped"
                )
                continue

            corr = lagged_cross_correlation(x, y, lags)
            opt_l, opt_c = optimal_lag(corr)
            _print_lag_table(sig_type, corr, opt_l, opt_c, n_dates)
            results_summary.append(f"{sig_type}:opt_lag={opt_l}:corr={opt_c:.4f}")

        descr = (
            f"events={len(events)}"
            f" signal_types={len(signal_types)}"
            f" max_lag={args.max_lag}"
            f" results=[{' '.join(results_summary)}]"
        )
        print(f"\n[run_lead_lag] done. {descr}")

    except Exception as exc:  # noqa: BLE001
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_lead_lag] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="run-lead-lag",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
