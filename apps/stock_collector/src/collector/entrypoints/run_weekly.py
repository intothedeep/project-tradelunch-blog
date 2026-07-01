"""Entrypoint: WEEKLY market-cap ranking + sticky-universe update.

Flow: assemble candidate pool (Wikipedia/IWB-class sources; here the GitHub
S&P500 CSV) -> observe each symbol's (market_cap, sector) -> screen.rank
(complete global + per-sector ranking) -> record ALL rows into market_rankings
(append) -> add the surfacing-depth winners (global top-20 + each sector top-10)
to tracked_symbols (STICKY UPSERT; never auto-removes).

market_cap observation (I2.8): derive ``shares x local close`` from the
``symbol_fundamentals`` cache (shares refreshed monthly via fast_info, sector
quarterly via ``.info``) + the daily ``market_history`` close — avoiding a
per-symbol ``.info`` call. A symbol with no cached close yet (new candidate)
falls back to a single ``fast_info`` market cap; the cache + reads are
table-guarded so the run still works on an un-migrated DB (0013 USER-gated).

Side effects: network + DB writes (delegated to sink/).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone

from collector.config.settings import database_url
from collector.ranking.fundamentals import derive_market_cap, plan_refresh
from collector.ranking.screen import MarketCapObs, rank
from collector.ranking.universe import assemble
from collector.schema.rows import FundamentalsRow, RankingRow, TrackedSymbol
from collector.sink import db_sink
from collector.sink.universe_fetch import fetch_sp500_symbols
from collector.sink.yahoo_fetch import (
    fetch_market_cap,
    fetch_sector,
    fetch_sector_and_name,
    fetch_shares_outstanding,
)
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


def _persist_refreshed(
    conn, plan_shares, plan_sector, fresh_shares, fresh_sector, fresh_name, now
) -> None:
    """Upsert just the refetched fields; stamp a clock only when a value came back.

    ``long_name`` rides the sector clock (same .info call), so the sector clock
    advances when EITHER the sector OR the name came back.
    """
    updates = [
        FundamentalsRow(
            symbol=sym,
            shares_outstanding=fresh_shares.get(sym),
            sector=fresh_sector.get(sym),
            long_name=fresh_name.get(sym),
            shares_refreshed_at=now if fresh_shares.get(sym) is not None else None,
            sector_refreshed_at=(
                now
                if (fresh_sector.get(sym) is not None or fresh_name.get(sym) is not None)
                else None
            ),
        )
        for sym in set(plan_shares) | set(plan_sector)
    ]
    db_sink.upsert_fundamentals(conn, updates)


def _observe(conn, symbols: list[str], limit: int, now: datetime) -> list[MarketCapObs]:
    """Build market-cap observations using the fundamentals cache (I2.8)."""
    targets = symbols[:limit] if limit else symbols
    cached = db_sink.read_fundamentals(conn)
    closes = db_sink.read_latest_close(conn, targets)
    plan = plan_refresh(targets, cached, now)

    fresh_shares = {s: fetch_shares_outstanding(s) for s in plan.shares}
    # One .info call per symbol yields both sector and company name.
    fresh_info = {s: fetch_sector_and_name(s) for s in plan.sector}
    fresh_sector = {s: v[0] for s, v in fresh_info.items()}
    fresh_name = {s: v[1] for s, v in fresh_info.items()}
    _persist_refreshed(
        conn, plan.shares, plan.sector, fresh_shares, fresh_sector, fresh_name, now
    )

    obs: list[MarketCapObs] = []
    for sym in targets:
        c = cached.get(sym)
        shares = fresh_shares.get(sym)
        if shares is None and c is not None:
            shares = c.shares_outstanding
        sector = fresh_sector.get(sym)
        if sector is None and c is not None:
            sector = c.sector
        cap = derive_market_cap(shares, closes.get(sym))
        if cap is None:  # new candidate w/o a local close yet -> single fast_info
            cap = fetch_market_cap(sym)
        obs.append(MarketCapObs(symbol=sym, sector=sector, market_cap=cap))
    return obs


def _dry_observe(symbols: list[str], limit: int) -> list[MarketCapObs]:
    """No-DB smoke: direct fast_info cap + .info sector for a small sample."""
    return [
        MarketCapObs(symbol=s, sector=fetch_sector(s), market_cap=fetch_market_cap(s))
        for s in symbols[: (limit or 5)]
    ]


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
        sample = _dry_observe(candidates, args.limit)
        winners = select_tracked_symbols(rank(sample, date.today()))
        print(f"[dry-run] candidates={len(candidates)} sampled={len(sample)} winners={len(winners)}")
        return 0

    now = datetime.now(timezone.utc)
    conn = db_sink.connect()
    status, descr = "success", ""
    try:
        observations = _observe(conn, candidates, args.limit, now)
        ranking_rows = rank(observations, date.today())
        winners = select_tracked_symbols(ranking_rows)
        tracked = [
            TrackedSymbol(
                symbol=sym, category="stocks", label=sym,
                sector=r.sector, source="yahoo", exchange=resolve_exchange(sym),
            )
            for sym, r in winners.items()
        ]
        n_rank = db_sink.insert_rankings(conn, ranking_rows)
        n_track = db_sink.upsert_tracked_symbols(conn, tracked, now)
        descr = (
            f"candidates={len(candidates)}|rankings={n_rank}"
            f"|tracked_upserted={n_track}"
        )
        print(f"[run_weekly] {descr}")
    except Exception as exc:  # noqa: BLE001 — record the failure row, then re-raise
        status = "failed"
        descr = f"error={type(exc).__name__}: {exc}"
        print(f"[run_weekly] FAILED {descr}")
        raise
    finally:
        db_sink.insert_batch_log(
            conn,
            job="collector-weekly",
            status=status,
            started_at=now,
            finished_at=datetime.now(timezone.utc),
            descr=descr,
        )
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
