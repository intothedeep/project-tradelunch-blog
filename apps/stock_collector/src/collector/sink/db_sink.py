"""IO boundary: Postgres reads/writes (psycopg3 ONLY here).

Writes are idempotent UPSERTs (``ON CONFLICT ... DO UPDATE``) via
``cursor.executemany`` (no psycopg2 ``execute_values``):
  * ``load_history``      -> market_history  ON CONFLICT(label,interval,bar_time)
  * ``refresh_snapshots`` -> market_snapshots ON CONFLICT(category,label)
Reads:
  * ``read_latest_bar``       -> {label: max(bar_time)} for incremental from_date
  * ``read_recent_history``   -> last N bars for one label (snapshot build)
  * ``read_tracked_symbols``  -> active sticky universe (table-guarded -> [] if absent)

Side effects: DB connection + writes. Soft-delete only (never hard-DELETE).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime

import psycopg

from collector.config.settings import database_url
from collector.schema.rows import (
    DEFAULT_INTERVAL,
    HistoryRow,
    RankingRow,
    SnapshotRow,
    TrackedSymbol,
)


def connect() -> psycopg.Connection:
    """Open a psycopg3 connection to the Supabase session pooler."""
    dsn = database_url()
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    # WHY: bar_time is TIMESTAMPTZ but we write bare dates, and the incremental
    # cursor (MAX(bar_time)::date) + reader's UTC date derivation all assume a
    # UTC session. Pin it so the invariant holds under any DATABASE_URL.
    return psycopg.connect(dsn, options="-c timezone=UTC")


# --- writes -----------------------------------------------------------------

_HISTORY_SQL = """
INSERT INTO market_history (label, interval, bar_time, open, high, low, close, volume)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (label, interval, bar_time) DO UPDATE SET
    open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
    close = EXCLUDED.close, volume = EXCLUDED.volume,
    updated_at = CURRENT_TIMESTAMP
"""

_SNAPSHOT_SQL = """
INSERT INTO market_snapshots
    (category, label, ticker, exchange, value, change_absolute, change_percent,
     as_of, revalidate_seconds, fetched_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (category, label) DO UPDATE SET
    ticker = EXCLUDED.ticker, exchange = EXCLUDED.exchange,
    value = EXCLUDED.value, change_absolute = EXCLUDED.change_absolute,
    change_percent = EXCLUDED.change_percent, as_of = EXCLUDED.as_of,
    revalidate_seconds = EXCLUDED.revalidate_seconds,
    fetched_at = EXCLUDED.fetched_at, updated_at = CURRENT_TIMESTAMP
"""


def load_history(conn: psycopg.Connection, rows: Sequence[HistoryRow]) -> int:
    """UPSERT history rows. Returns count submitted. Idempotent."""
    if not rows:
        return 0
    params = [
        (r.label, r.interval, r.bar_time, r.open, r.high, r.low, r.close, r.volume)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_HISTORY_SQL, params)
    conn.commit()
    return len(params)


def refresh_snapshots(conn: psycopg.Connection, snaps: Sequence[SnapshotRow]) -> int:
    """UPSERT snapshot rows (stocks carry ticker/exchange). Idempotent."""
    if not snaps:
        return 0
    params = [
        (
            s.category, s.label, s.ticker, s.exchange, s.value,
            s.change_absolute, s.change_percent, s.as_of,
            s.revalidate_seconds, s.fetched_at,
        )
        for s in snaps
    ]
    with conn.cursor() as cur:
        cur.executemany(_SNAPSHOT_SQL, params)
    conn.commit()
    return len(params)


# --- reads ------------------------------------------------------------------


def read_latest_bar(
    conn: psycopg.Connection, interval: str = DEFAULT_INTERVAL
) -> dict[str, date]:
    """{label: max(bar_time)} for incremental from_date computation."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT label, MAX(bar_time)::date FROM market_history "
            "WHERE interval = %s GROUP BY label",
            (interval,),
        )
        return {label: d for label, d in cur.fetchall()}


def read_recent_history(
    conn: psycopg.Connection, label: str, interval: str = DEFAULT_INTERVAL, n: int = 2
) -> list[HistoryRow]:
    """Last ``n`` bars for ``label`` (ascending), for snapshot building."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT label, interval, bar_time::date, open, high, low, close, volume "
            "FROM market_history WHERE label = %s AND interval = %s "
            "ORDER BY bar_time DESC LIMIT %s",
            (label, interval, n),
        )
        rows = [
            HistoryRow(lb, iv, bt, float(o), float(h), float(lo), float(c), int(v))
            for (lb, iv, bt, o, h, lo, c, v) in cur.fetchall()
        ]
    rows.reverse()  # ascending
    return rows


# --- Phase 2 writes (sticky universe + rankings) ----------------------------

_TRACKED_UPSERT_SQL = """
INSERT INTO tracked_symbols
    (symbol, category, label, sector, source, exchange, first_ranked_at, last_ranked_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (symbol) DO UPDATE SET
    category = EXCLUDED.category, label = EXCLUDED.label, sector = EXCLUDED.sector,
    source = EXCLUDED.source, exchange = EXCLUDED.exchange,
    first_ranked_at = COALESCE(tracked_symbols.first_ranked_at, EXCLUDED.first_ranked_at),
    last_ranked_at = EXCLUDED.last_ranked_at,
    deleted_at = NULL,  -- sticky: revive any soft-deleted row on re-rank
    updated_at = CURRENT_TIMESTAMP
"""

_RANKINGS_SQL = """
INSERT INTO market_rankings (as_of, symbol, scope, sector, rank, market_cap)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (as_of, symbol, scope) DO UPDATE SET
    sector = EXCLUDED.sector, rank = EXCLUDED.rank, market_cap = EXCLUDED.market_cap
"""


def upsert_tracked_symbols(
    conn: psycopg.Connection, rows: Sequence[TrackedSymbol], ranked_at: datetime
) -> int:
    """STICKY UPSERT: insert new, refresh existing, revive soft-deleted. Never deletes."""
    if not rows:
        return 0
    params = [
        (r.symbol, r.category, r.label, r.sector, r.source, r.exchange, ranked_at, ranked_at)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_TRACKED_UPSERT_SQL, params)
    conn.commit()
    return len(params)


def insert_rankings(conn: psycopg.Connection, rows: Sequence[RankingRow]) -> int:
    """Append weekly ranking rows (idempotent per (as_of,symbol,scope))."""
    if not rows:
        return 0
    params = [(r.as_of, r.symbol, r.scope, r.sector, r.rank, r.market_cap) for r in rows]
    with conn.cursor() as cur:
        cur.executemany(_RANKINGS_SQL, params)
    conn.commit()
    return len(params)


def read_tracked_symbols(conn: psycopg.Connection) -> list[TrackedSymbol]:
    """Active sticky universe; table-guarded -> [] when tracked_symbols absent (Phase 1)."""
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.tracked_symbols')")
        if cur.fetchone()[0] is None:
            return []
        cur.execute(
            "SELECT symbol, category, label, sector, source, exchange "
            "FROM tracked_symbols WHERE deleted_at IS NULL"
        )
        return [
            TrackedSymbol(symbol=s, category=cat, label=lb, sector=sec, source=src, exchange=ex)
            for (s, cat, lb, sec, src, ex) in cur.fetchall()
        ]
