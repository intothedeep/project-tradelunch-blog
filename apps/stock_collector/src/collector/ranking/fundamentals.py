"""Pure: fundamentals freshness + market-cap derivation (I2.8).

The weekly rank caches ``shares_outstanding`` (monthly) and ``sector`` (quarterly)
so it derives ``market_cap = shares x close`` instead of calling yfinance ``.info``
per symbol. This module decides WHICH symbols need a refetch and HOW to derive the
cap — deterministically, with no network or DB. The orchestration (run_weekly)
turns the plan into the few live calls + DB writes.

Invariants: deterministic; no side effects.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from collector.schema.rows import FundamentalsRow

SHARES_MAX_AGE = timedelta(days=30)  # monthly fast_info refresh
SECTOR_MAX_AGE = timedelta(days=90)  # quarterly .info refresh


def is_stale(refreshed_at: datetime | None, now: datetime, max_age: timedelta) -> bool:
    """True when never refreshed or older than ``max_age``."""
    return refreshed_at is None or (now - refreshed_at) >= max_age


def derive_market_cap(shares: float | None, close: float | None) -> float | None:
    """``shares * close`` when both known; else None (caller falls back to fast_info)."""
    if shares is None or close is None:
        return None
    return float(shares) * float(close)


@dataclass(frozen=True)
class RefreshPlan:
    """Symbols needing a live refetch this run (the only network the cache incurs)."""

    shares: tuple[str, ...]
    sector: tuple[str, ...]


def plan_refresh(
    symbols: Sequence[str], cached: Mapping[str, FundamentalsRow], now: datetime
) -> RefreshPlan:
    """Pick stale/missing symbols per field. Warm cache -> near-empty plan."""
    shares: list[str] = []
    sector: list[str] = []
    for sym in symbols:
        f = cached.get(sym)
        if f is None or is_stale(f.shares_refreshed_at, now, SHARES_MAX_AGE):
            shares.append(sym)
        # The .info refetch (sector) also carries long_name — force it when the
        # name is still missing so a newly-added column backfills in one pass.
        if (
            f is None
            or is_stale(f.sector_refreshed_at, now, SECTOR_MAX_AGE)
            or f.long_name is None
        ):
            sector.append(sym)
    return RefreshPlan(tuple(shares), tuple(sector))
