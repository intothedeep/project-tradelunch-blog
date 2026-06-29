"""Pure: market-cap observations -> ranked ``RankingRow`` rows.

Produces a COMPLETE ranking (every observation gets a rank) for BOTH scopes:
  * scope='global' — all symbols ranked 1..N by market cap;
  * scope='sector' — within each sector, ranked 1..M.
Top-20 (global) / top-10 (sector) are *surfacing depths* applied at query time,
NOT a storage truncation — market_rankings is a complete append-only series.

Determinism: sort by market_cap DESC, then symbol ASC; a missing market_cap
(None) sorts LAST (still recorded, ranked after all known caps). Pure, no I/O.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Optional

from collector.schema.rows import RankingRow


@dataclass(frozen=True)
class MarketCapObs:
    """One weekly market-cap observation for a tracked symbol."""

    symbol: str
    sector: Optional[str]
    market_cap: Optional[float]


def _sort_key(obs: MarketCapObs) -> tuple[int, float, str]:
    # known caps first (0), unknown last (1); then cap desc (negate), then symbol asc
    has_cap = 0 if obs.market_cap is not None else 1
    cap = -(obs.market_cap or 0.0)
    return (has_cap, cap, obs.symbol)


def rank(observations: Iterable[MarketCapObs], as_of: date) -> list[RankingRow]:
    """Return global + per-sector ranking rows for the week ``as_of``."""
    obs = list(observations)
    rows: list[RankingRow] = []

    # global
    for i, o in enumerate(sorted(obs, key=_sort_key), start=1):
        rows.append(
            RankingRow(
                as_of=as_of, symbol=o.symbol, scope="global",
                rank=i, sector=o.sector, market_cap=o.market_cap,
            )
        )

    # per sector (skip symbols without a sector)
    sectors: dict[str, list[MarketCapObs]] = {}
    for o in obs:
        if o.sector:
            sectors.setdefault(o.sector, []).append(o)
    for sector in sorted(sectors):
        for i, o in enumerate(sorted(sectors[sector], key=_sort_key), start=1):
            rows.append(
                RankingRow(
                    as_of=as_of, symbol=o.symbol, scope="sector",
                    rank=i, sector=sector, market_cap=o.market_cap,
                )
            )
    return rows
