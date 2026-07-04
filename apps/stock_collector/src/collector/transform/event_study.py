"""Pure: event-study / forward-return computation for signal validation (Phase R).

Purpose: given an event date and a price series, compute the cumulative (abnormal)
return over each requested horizon window. The entry bar is strictly AFTER the event
date (look-ahead gate). All math is per-event; aggregation (t-stat, hit-rate) lives
in the SQL view v_signal_backtest_summary, NOT here.

Invariants:
  - event_window_start returns event_date + 1 day. Aligning to available bars
    (skipping weekends / holidays) is implicit: the caller's price_series contains
    only real trading bars, so the first bar with date > event_date is naturally the
    next trading day.
  - cumulative_abnormal_return uses the first bar after the event as the entry price;
    each horizon h takes the closing price h bars after entry (0-indexed from entry).
    A horizon of 1 means "next bar only" (one bar forward from entry).
  - Returns None for a horizon when fewer than (h+1) bars are available after the
    event: entry bar counts as bar 0, so horizon h requires bars 0..h inclusive.
  - benchmark_series is optional: when given, subtract the benchmark's return over
    the same bar-count window starting from the gate. The benchmark is aligned by
    bar position (not by date) to handle gaps symmetrically. When the benchmark
    also has fewer than h+1 bars after the gate, the abnormal return is None.
  - directional_hit returns True for 'buy' when car > 0; True for 'sell' when car < 0.
    car == 0.0 is False (no edge).

Side effects: none.
"""

from __future__ import annotations

from datetime import date, timedelta

__all__ = [
    "event_window_start",
    "cumulative_abnormal_return",
    "directional_hit",
]

_DEFAULT_HORIZONS = (1, 5, 21)


def event_window_start(event_date: date) -> date:
    """Return the first look-ahead date: ``event_date + 1 day``.

    The returned date is the earliest date eligible as the entry bar.
    Weekends and holidays are handled implicitly by the caller's price_series
    (which only contains real trading bars) — the consumer filters bars with
    date >= event_window_start(event_date).

    Args:
        event_date: the signal event date (disclosure_date / filing_date).

    Returns:
        ``event_date + timedelta(days=1)``

    Pure — no IO, no clock read.
    """
    return event_date + timedelta(days=1)


def cumulative_abnormal_return(
    event_date: date,
    price_series: list[tuple[date, float]],
    horizons: tuple[int, ...] = _DEFAULT_HORIZONS,
    benchmark_series: list[tuple[date, float]] | None = None,
) -> dict[int, float | None]:
    """Compute cumulative (abnormal) return for each horizon after the event.

    The entry bar is the first bar in ``price_series`` whose date is strictly
    after ``event_date`` (i.e. date >= event_window_start(event_date)).
    price_series MUST be sorted ascending by date.

    Return for horizon h:
        raw_return = (price[entry+h] - price[entry]) / price[entry]
        abnormal   = raw_return - benchmark_return (if benchmark given)
        None       = insufficient bars (entry missing, or entry+h out of bounds;
                     or benchmark has fewer than h+1 bars after the gate)

    Benchmark alignment: the benchmark is sliced by the same gate (first bar on or
    after event_window_start) and indexed positionally — bar[0] is entry, bar[h] is
    exit. This mirrors the stock alignment so both series are compared over the same
    number of forward bars regardless of date gaps.

    Args:
        event_date:       signal event date — entry is first bar strictly after this.
        price_series:     ascending (date, close) pairs (real trading bars only).
        horizons:         tuple of forward-bar counts to compute (default: 1, 5, 21).
        benchmark_series: optional ascending (date, close) pairs for SPY / index.
                          When provided, returns abnormal return (stock minus benchmark).
                          Both sliced from gate; if benchmark is shorter, that
                          horizon returns None.

    Returns:
        {horizon: float | None} for each value in ``horizons``.

    Pure — no IO, no clock read.
    """
    gate = event_window_start(event_date)

    # Slice to bars on or after the gate (strictly after event_date).
    entry_bars = [(d, c) for d, c in price_series if d >= gate]

    # Pre-slice benchmark the same way so positional indexing is symmetric.
    bm_bars: list[tuple[date, float]] | None = None
    if benchmark_series is not None:
        bm_bars = [(d, c) for d, c in benchmark_series if d >= gate]

    result: dict[int, float | None] = {}
    for h in horizons:
        # Horizon h needs bars[0] (entry) and bars[h] (exit). Total = h+1 bars.
        if len(entry_bars) < h + 1:
            result[h] = None
            continue

        entry_price = entry_bars[0][1]
        exit_price = entry_bars[h][1]

        if entry_price == 0.0:
            result[h] = None
            continue

        raw = (exit_price - entry_price) / entry_price

        if bm_bars is None:
            result[h] = raw
            continue

        # Require the benchmark to cover the same h+1 bars from the gate.
        if len(bm_bars) < h + 1:
            result[h] = None
            continue

        bm_entry = bm_bars[0][1]
        bm_exit = bm_bars[h][1]

        if bm_entry == 0.0:
            result[h] = None
            continue

        bm_return = (bm_exit - bm_entry) / bm_entry
        result[h] = raw - bm_return

    return result


def directional_hit(car: float, direction: str) -> bool:
    """Return True when the directional prediction was correct.

    'buy'  → hit when car > 0 (price went up).
    'sell' → hit when car < 0 (price went down).
    car == 0.0 is False in both cases (no edge).

    Args:
        car:       cumulative (abnormal) return for a given horizon.
        direction: 'buy' or 'sell'.

    Returns:
        bool indicating directional correctness.

    Raises:
        ValueError: unknown direction string.

    Pure — no IO.
    """
    if direction == "buy":
        return car > 0.0
    if direction == "sell":
        return car < 0.0
    raise ValueError(
        f"directional_hit: unknown direction '{direction}'; expected 'buy' or 'sell'"
    )
