"""Entrypoint: WEEKLY market-cap ranking + sticky-universe update.

Flow: assemble candidate pool (Wikipedia/IWB-class sources; here the GitHub
S&P500 CSV) -> fetch market_cap + sector per symbol (best-effort, partial OK) ->
screen.rank (complete global + per-sector ranking) -> record ALL rows into
market_rankings (append) -> add the surfacing-depth winners (global top-20 +
each sector top-10) to tracked_symbols (STICKY UPSERT; never auto-removes).

Sticky rule: tracked symbols are collected daily forever; soft-delete only.
Graceful: a symbol whose market cap can't be fetched is ranked last (None),
never aborts the run.

Side effects: network + DB writes (delegated to sink/).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import database_url
from collector.ranking.screen import MarketCapObs, rank
from collector.ranking.universe import assemble
from collector.schema.rows import RankingRow, TrackedSymbol
from collector.sink import db_sink
from collector.sink.universe_fetch import fetch_sp500_symbols
from collector.sink.yahoo_fetch import fetch_marketcap_sector
from collector.transform.mapping import resolve_exchange

GLOBAL_TOP = 20
SECTOR_TOP = 10


def select_tracked_symbols(rows: list[RankingRow]) -> dict[str, RankingRow]:
    """Pure: pick global top-20 + per-sector top-10 winners (de-duped by symbol)."""
    chosen: dict[str, RankingRow] = {}
    for r in rows:
        if r.scope == "global" and r.rank <= GLOBAL_TOP:
            chosen.setdefault(r.symbol, r)
        elif r.scope == "sector" and r.rank <= SECTOR_TOP:
            chosen.setdefault(r.symbol, r)
    return chosen


def _observe(symbols: list[str], limit: int) -> list[MarketCapObs]:
    targets = symbols[:limit] if limit else symbols
    obs: list[MarketCapObs] = []
    for sym in targets:
        mc, sector = fetch_marketcap_sector(sym)
        obs.append(MarketCapObs(symbol=sym, sector=sector, market_cap=mc))
    return obs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Weekly market-cap ranking")
    parser.add_argument("--limit", type=int, default=0, help="cap candidates (0=all)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    candidates = assemble(fetch_sp500_symbols())
    if not candidates:
        print("[run_weekly] no candidates fetched — aborting (sources down)")
        return 1

    if args.dry_run or not database_url():
        sample = _observe(candidates, args.limit or 5)
        rows = rank(sample, date.today())
        winners = select_tracked_symbols(rows)
        print(f"[dry-run] candidates={len(candidates)} sampled={len(sample)} winners={len(winners)}")
        return 0

    observations = _observe(candidates, args.limit)
    as_of = date.today()
    ranking_rows = rank(observations, as_of)
    winners = select_tracked_symbols(ranking_rows)

    ranked_at = datetime.now(timezone.utc)
    tracked = [
        TrackedSymbol(
            symbol=sym, category="stocks", label=sym,
            sector=r.sector, source="yahoo", exchange=resolve_exchange(sym),
        )
        for sym, r in winners.items()
    ]

    conn = db_sink.connect()
    try:
        n_rank = db_sink.insert_rankings(conn, ranking_rows)
        n_track = db_sink.upsert_tracked_symbols(conn, tracked, ranked_at)
        print(
            f"[run_weekly] candidates={len(candidates)} rankings={n_rank} "
            f"tracked_upserted={n_track}"
        )
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
