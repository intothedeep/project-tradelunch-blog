"""IO boundary: Postgres reads/writes (psycopg3 ONLY here).

Writes are idempotent UPSERTs (``ON CONFLICT ... DO UPDATE``) via
``cursor.executemany`` (no psycopg2 ``execute_values``):
  * ``load_history``      -> market_history  ON CONFLICT(label,interval,bar_time)
  * ``refresh_snapshots`` -> market_snapshots ON CONFLICT(category,label)
Reads:
  * ``read_latest_bar``       -> {label: max(bar_time)} for incremental from_date
  * ``read_recent_history``   -> last N bars for one label (snapshot build)
  * ``read_tracked_symbols``  -> active sticky universe (table-guarded -> [] if absent)
Prune (Phase M):
  * ``read_prune_candidates`` -> {label: (min_date, count)} bars older than cutoff
  * ``delete_history_before`` -> hard-DELETE rows < cutoff for one label; caller commits

Side effects: DB connection + writes. Soft-delete only (never hard-DELETE) EXCEPT
for the explicit retention prune path (delete_history_before), which is guarded by
Parquet object-existence checks in the caller before any row is deleted.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime

import psycopg

from collector.config.settings import database_url
from collector.schema.rows import (
    DEFAULT_INTERVAL,
    FundamentalsRow,
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


_BATCH_LOG_SQL = """
INSERT INTO batch_log (job, status, resolved, started_at, finished_at, descr)
VALUES (%s, %s, %s, %s, %s, %s)
"""


def insert_batch_log(
    conn: psycopg.Connection,
    *,
    job: str,
    status: str,
    started_at: datetime,
    finished_at: datetime,
    descr: str,
) -> bool:
    """Best-effort: append ONE batch-run row. NEVER raises — a missing table
    (migration 0015 not applied) or any insert error is swallowed so it can't
    fail the collection job. ``success`` -> resolved=1, else 0 (open-failure
    tracker). Rolls back first to clear any aborted tx from a failed run, so the
    failure row itself still lands."""
    resolved = 1 if status == "success" else 0
    try:
        conn.rollback()  # clear any aborted/in-progress tx -> clean insert
        with conn.cursor() as cur:
            cur.execute(
                _BATCH_LOG_SQL,
                (job, status, resolved, started_at, finished_at, descr),
            )
        conn.commit()
        return True
    except Exception as exc:  # noqa: BLE001 — op log, must never abort the job
        conn.rollback()
        print(f"[batch_log] skipped ({type(exc).__name__}: {exc})")
        return False


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


# --- I2.8 fundamentals cache (shares + sector) ------------------------------

_FUNDAMENTALS_UPSERT_SQL = """
INSERT INTO symbol_fundamentals
    (symbol, shares_outstanding, sector, shares_refreshed_at, sector_refreshed_at)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (symbol) DO UPDATE SET
    shares_outstanding =
        COALESCE(EXCLUDED.shares_outstanding, symbol_fundamentals.shares_outstanding),
    sector = COALESCE(EXCLUDED.sector, symbol_fundamentals.sector),
    shares_refreshed_at =
        COALESCE(EXCLUDED.shares_refreshed_at, symbol_fundamentals.shares_refreshed_at),
    sector_refreshed_at =
        COALESCE(EXCLUDED.sector_refreshed_at, symbol_fundamentals.sector_refreshed_at),
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
"""


def read_fundamentals(conn: psycopg.Connection) -> dict[str, FundamentalsRow]:
    """{symbol: FundamentalsRow} cache; table-guarded -> {} when absent (un-migrated)."""
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.symbol_fundamentals')")
        if cur.fetchone()[0] is None:
            return {}
        cur.execute(
            "SELECT symbol, shares_outstanding, sector, shares_refreshed_at, "
            "sector_refreshed_at FROM symbol_fundamentals WHERE deleted_at IS NULL"
        )
        return {
            sym: FundamentalsRow(
                symbol=sym,
                shares_outstanding=float(sh) if sh is not None else None,
                sector=sec,
                shares_refreshed_at=sra,
                sector_refreshed_at=secra,
            )
            for (sym, sh, sec, sra, secra) in cur.fetchall()
        }


def read_latest_close(
    conn: psycopg.Connection, symbols: Sequence[str], interval: str = DEFAULT_INTERVAL
) -> dict[str, float]:
    """{label: latest close} from market_history for the given symbols (label == symbol)."""
    if not symbols:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT h.label, h.close FROM market_history h "
            "JOIN (SELECT label, MAX(bar_time) AS mx FROM market_history "
            "      WHERE interval = %s AND label = ANY(%s) GROUP BY label) m "
            "  ON h.label = m.label AND h.bar_time = m.mx AND h.interval = %s",
            (interval, list(symbols), interval),
        )
        return {label: float(c) for label, c in cur.fetchall()}


def upsert_fundamentals(conn: psycopg.Connection, rows: Sequence[FundamentalsRow]) -> int:
    """COALESCE-merge cache rows; a clock advances only when its value was refetched."""
    if not rows:
        return 0
    params = [
        (r.symbol, r.shares_outstanding, r.sector, r.shares_refreshed_at, r.sector_refreshed_at)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_FUNDAMENTALS_UPSERT_SQL, params)
    conn.commit()
    return len(params)


# --- Phase M: retention prune -----------------------------------------------


def read_prune_candidates(
    conn: psycopg.Connection,
    cutoff: date,
    interval: str = DEFAULT_INTERVAL,
) -> dict[str, tuple[date, int]]:
    """{label: (min_bar_date, count)} for bars strictly older than ``cutoff``.

    Only labels that have at least one bar before the cutoff are returned.
    The caller uses (min_bar_date.year, cutoff) with prunable_years() to derive
    which Parquet objects must exist before any deletion proceeds.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT label, MIN(bar_time)::date, COUNT(*) "
            "FROM market_history "
            "WHERE interval = %s AND bar_time < %s "
            "GROUP BY label",
            (interval, cutoff),
        )
        return {label: (min_date, int(cnt)) for label, min_date, cnt in cur.fetchall()}


def delete_history_before(
    conn: psycopg.Connection,
    label: str,
    cutoff: date,
    interval: str = DEFAULT_INTERVAL,
) -> int:
    """Hard-DELETE market_history rows for ``label`` with bar_time strictly < ``cutoff``.

    Returns the number of rows deleted (``cur.rowcount``). The caller is responsible
    for committing after each label so partial progress is preserved on interruption.

    Invariant: caller MUST verify all Parquet objects exist (via object_exists) before
    calling this function — this is the sole hard-delete in the codebase and is only
    safe when the archive is confirmed present.
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM market_history WHERE label = %s AND interval = %s AND bar_time < %s",
            (label, interval, cutoff),
        )
        return cur.rowcount
