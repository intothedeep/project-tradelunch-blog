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
Prune (Phase N — log TTL + rankings retention):
  * ``delete_error_log_before`` / ``delete_batch_log_before`` -> sanctioned no-tombstone
    TTL hard-DELETE on the two log tables (migrations 0014/0015 exception; no archive)
  * ``read_rankings_prune_years`` / ``delete_rankings_before`` -> market_rankings
    retention (domain data; caller archive-verifies first when enabled)

Side effects: DB connection + writes. Soft-delete only (never hard-DELETE) EXCEPT
the explicit retention prune paths (delete_history_before, and the Phase N deletes
above), each guarded in the caller (Parquet object-existence for domain data; an
owner-approved no-tombstone exception for the log tables) before any row is deleted.
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
    # prepare_threshold=None disables psycopg3 server-side auto-prepare: the
    # Supabase pooler rotates the underlying server connection, so a statement
    # prepared after N reuses (e.g. the same upsert across 434 backfill filers)
    # vanishes → "prepared statement _pg3_x does not exist". Disabling is the
    # Supabase-pooler-safe setting and harmless for our executemany-heavy path.
    return psycopg.connect(
        dsn, options="-c timezone=UTC", prepare_threshold=None
    )


# --- writes -----------------------------------------------------------------

_HISTORY_SQL = """
INSERT INTO market_history (label, interval, bar_time, open, high, low, close, volume, dividends, stock_splits)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (label, interval, bar_time) DO UPDATE SET
    open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
    close = EXCLUDED.close, volume = EXCLUDED.volume,
    dividends = EXCLUDED.dividends, stock_splits = EXCLUDED.stock_splits,
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
        (r.label, r.interval, r.bar_time, r.open, r.high, r.low, r.close, r.volume,
         r.dividends, r.stock_splits)
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

_ERROR_LOG_SQL = """
INSERT INTO error_log (message, path, source)
VALUES (%s, %s, 'collector')
"""


def insert_error_log(
    conn: psycopg.Connection, *, message: str, path: str
) -> bool:
    """Best-effort: append ONE error_log row (source='collector'). NEVER raises —
    a missing table or any insert error is swallowed so it can't fail the job.
    Used for operational alerts (e.g. isolated-date/non-trading-day suspects)."""
    try:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(_ERROR_LOG_SQL, (message, path))
        conn.commit()
        return True
    except Exception as exc:  # noqa: BLE001 — op log, must never abort the job
        conn.rollback()
        print(f"[error_log] skipped ({type(exc).__name__}: {exc})")
        return False


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

# Two variants so the run survives a DB where migration 0018 (long_name column)
# has not been applied yet — column presence is probed at call time.
_FUNDAMENTALS_UPSERT_SQL = """
INSERT INTO symbol_fundamentals
    (symbol, shares_outstanding, sector, long_name,
     shares_refreshed_at, sector_refreshed_at)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (symbol) DO UPDATE SET
    shares_outstanding =
        COALESCE(EXCLUDED.shares_outstanding, symbol_fundamentals.shares_outstanding),
    sector = COALESCE(EXCLUDED.sector, symbol_fundamentals.sector),
    long_name = COALESCE(EXCLUDED.long_name, symbol_fundamentals.long_name),
    shares_refreshed_at =
        COALESCE(EXCLUDED.shares_refreshed_at, symbol_fundamentals.shares_refreshed_at),
    sector_refreshed_at =
        COALESCE(EXCLUDED.sector_refreshed_at, symbol_fundamentals.sector_refreshed_at),
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
"""

_FUNDAMENTALS_UPSERT_SQL_NO_NAME = """
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


def _has_long_name_column(cur: psycopg.Cursor) -> bool:
    """True when migration 0018 (symbol_fundamentals.long_name) is applied."""
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = 'symbol_fundamentals' "
        "AND column_name = 'long_name'"
    )
    return cur.fetchone() is not None


def read_fundamentals(conn: psycopg.Connection) -> dict[str, FundamentalsRow]:
    """{symbol: FundamentalsRow} cache; table-guarded -> {} when absent (un-migrated).

    Tolerant of a pre-0018 DB: selects long_name only when the column exists.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.symbol_fundamentals')")
        if cur.fetchone()[0] is None:
            return {}
        # Whitelisted literal (one of two constants) — injection-safe.
        name_col = "long_name" if _has_long_name_column(cur) else "NULL::text"
        cur.execute(
            f"SELECT symbol, shares_outstanding, sector, {name_col}, "
            "shares_refreshed_at, sector_refreshed_at "
            "FROM symbol_fundamentals WHERE deleted_at IS NULL"
        )
        return {
            sym: FundamentalsRow(
                symbol=sym,
                shares_outstanding=float(sh) if sh is not None else None,
                sector=sec,
                long_name=name,
                shares_refreshed_at=sra,
                sector_refreshed_at=secra,
            )
            for (sym, sh, sec, name, sra, secra) in cur.fetchall()
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
    """COALESCE-merge cache rows; a clock advances only when its value was refetched.

    Tolerant of a pre-0018 DB: writes long_name only when the column exists.
    """
    if not rows:
        return 0
    with conn.cursor() as cur:
        if _has_long_name_column(cur):
            sql = _FUNDAMENTALS_UPSERT_SQL
            params = [
                (
                    r.symbol,
                    r.shares_outstanding,
                    r.sector,
                    r.long_name,
                    r.shares_refreshed_at,
                    r.sector_refreshed_at,
                )
                for r in rows
            ]
        else:
            sql = _FUNDAMENTALS_UPSERT_SQL_NO_NAME
            params = [
                (
                    r.symbol,
                    r.shares_outstanding,
                    r.sector,
                    r.shares_refreshed_at,
                    r.sector_refreshed_at,
                )
                for r in rows
            ]
        cur.executemany(sql, params)
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


# --- Phase N: log TTL + rankings retention prune ----------------------------


def count_error_log_before(conn: psycopg.Connection, cutoff: datetime) -> int:
    """COUNT of error_log rows with created_at strictly < ``cutoff`` (dry-run preview)."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM error_log WHERE created_at < %s", (cutoff,))
        return int(cur.fetchone()[0])


def delete_error_log_before(conn: psycopg.Connection, cutoff: datetime) -> int:
    """Hard-DELETE error_log rows with created_at strictly < ``cutoff``.

    Sanctioned no-tombstone TTL (migration 0014 owner exception): error_log is an
    operational log with no ``deleted_at`` column, pruned purely by age. Caller
    commits. Returns ``cur.rowcount``.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM error_log WHERE created_at < %s", (cutoff,))
        return cur.rowcount


def count_batch_log_before(
    conn: psycopg.Connection, cutoff: datetime, *, keep_open_failures: bool = True
) -> int:
    """COUNT of batch_log rows that delete_batch_log_before would remove (dry-run)."""
    sql = "SELECT COUNT(*) FROM batch_log WHERE created_at < %s"
    if keep_open_failures:
        sql += " AND resolved = 1"
    with conn.cursor() as cur:
        cur.execute(sql, (cutoff,))
        return int(cur.fetchone()[0])


def delete_batch_log_before(
    conn: psycopg.Connection, cutoff: datetime, *, keep_open_failures: bool = True
) -> int:
    """Hard-DELETE batch_log rows with created_at strictly < ``cutoff``.

    Sanctioned no-tombstone TTL (migration 0015 owner exception). When
    ``keep_open_failures`` is True (default), rows with ``resolved = 0`` are
    RETAINED regardless of age — an unresolved failure must not be silently
    pruned before anyone triages it. Caller commits. Returns ``cur.rowcount``.
    """
    sql = "DELETE FROM batch_log WHERE created_at < %s"
    if keep_open_failures:
        sql += " AND resolved = 1"
    with conn.cursor() as cur:
        cur.execute(sql, (cutoff,))
        return cur.rowcount


def read_rankings_years(conn: psycopg.Connection) -> list[int]:
    """Distinct ``as_of`` years present in market_rankings, ascending.

    Used by the archive writer (Phase N) to enumerate which year files to
    (re)build before a retention prune can trust the cold Parquet copy.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT EXTRACT(YEAR FROM as_of)::int AS y "
            "FROM market_rankings ORDER BY y"
        )
        return [int(row[0]) for row in cur.fetchall()]


def read_rankings_by_year(conn: psycopg.Connection, year: int) -> list[dict]:
    """All market_rankings rows whose ``as_of`` falls in ``year`` (archive source).

    Returns plain dicts keyed by column name for rankings_parquet_sink.write_year.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT as_of, symbol, scope, sector, rank, market_cap "
            "FROM market_rankings WHERE EXTRACT(YEAR FROM as_of) = %s "
            "ORDER BY as_of, scope, rank",
            (year,),
        )
        cols = ("as_of", "symbol", "scope", "sector", "rank", "market_cap")
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def read_rankings_prune_years(conn: psycopg.Connection, cutoff: date) -> list[int]:
    """Distinct ``as_of`` years strictly older than ``cutoff``, ascending.

    Mirrors ``read_prune_candidates`` for market_rankings: the caller uses these
    years to probe one Parquet object per year before any delete (when
    archive-verify is enabled). Empty list when nothing is older than the cutoff.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT EXTRACT(YEAR FROM as_of)::int AS y "
            "FROM market_rankings WHERE as_of < %s ORDER BY y",
            (cutoff,),
        )
        return [int(row[0]) for row in cur.fetchall()]


def delete_rankings_before(conn: psycopg.Connection, cutoff: date) -> int:
    """Hard-DELETE market_rankings rows with ``as_of`` strictly < ``cutoff``.

    market_rankings is DOMAIN data (not a log exception) and effectively
    non-reproducible (no shares-outstanding history), so the caller MUST confirm
    the Parquet archive first when verify is enabled — never a partial delete.
    Caller commits. Returns ``cur.rowcount``.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM market_rankings WHERE as_of < %s", (cutoff,))
        return cur.rowcount


# --- Phase Q: politician ticker promotion -----------------------------------

_POLITICIAN_TICKER_SQL = """
SELECT
    ticker,
    COUNT(DISTINCT filer_id)::int AS distinct_filers,
    COUNT(*)::int                 AS trade_count
FROM politician_trades
WHERE ticker IS NOT NULL
  AND asset_type = 'equity'
  AND deleted_at IS NULL
GROUP BY ticker
ORDER BY COUNT(DISTINCT filer_id) DESC, COUNT(*) DESC, ticker ASC
"""


def read_top_politician_tickers(
    conn: psycopg.Connection, limit: int = 0
) -> list[tuple[str, int, int]]:
    """Return (ticker, distinct_filers, trade_count) rows from politician_trades.

    Groups by ticker, filtering to non-null equity trades with no soft-delete.
    Ordered by distinct-politician breadth DESC, total trades DESC, ticker ASC.

    Args:
        conn:  psycopg3 connection.
        limit: SQL LIMIT cap (0 = no limit — fetch all distinct tickers).
    """
    sql = _POLITICIAN_TICKER_SQL
    params: tuple = ()
    if limit > 0:
        sql = sql.rstrip() + " LIMIT %s"
        params = (limit,)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [(ticker, int(df), int(tc)) for ticker, df, tc in cur.fetchall()]


# --- Phase R: signal backtest reads + upsert --------------------------------

_RETURNS_WINDOW_SQL = """
SELECT bar_time::date, close
FROM market_history
WHERE label = %s
  AND interval = %s
  AND bar_time > %s
ORDER BY bar_time ASC
LIMIT %s
"""

_POLITICIAN_EVENTS_SQL = """
SELECT
    CASE transaction_type
        WHEN 'buy'  THEN 'politician_buy'
        ELSE             'politician_sell'
    END                  AS signal_type,
    ticker,
    disclosure_date      AS event_date,
    transaction_type     AS direction
FROM politician_trades
WHERE ticker IS NOT NULL
  AND asset_type = 'equity'
  AND transaction_type IN ('buy', 'sell')
  AND deleted_at IS NULL
  AND disclosure_date >= %s
ORDER BY disclosure_date DESC
LIMIT %s
"""

_SEC_NEW_POSITION_EVENTS_SQL = """
SELECT
    '13f_new_position'  AS signal_type,
    ticker,
    filing_date         AS event_date,
    'buy'               AS direction
FROM mv_sec_new_positions
WHERE filing_date >= %s
ORDER BY filing_date DESC
LIMIT %s
"""

_BACKTEST_UPSERT_SQL = """
INSERT INTO signal_backtest
    (signal_type, ticker, as_of, horizon_days, car, is_hit)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (signal_type, ticker, as_of, horizon_days) DO UPDATE SET
    car        = EXCLUDED.car,
    is_hit     = EXCLUDED.is_hit,
    updated_at = CURRENT_TIMESTAMP
"""

_UPSERT_CHUNK = 500  # rows per executemany/commit — bounds round-trips + connection lifetime


def read_returns_window(
    conn: psycopg.Connection,
    ticker: str,
    start_date: date,
    num_bars: int,
    interval: str = DEFAULT_INTERVAL,
) -> list[tuple[date, float]]:
    """Return ascending (bar_date, close) tuples for ``ticker`` after ``start_date``.

    Fetches up to ``num_bars`` rows from market_history with bar_time > start_date.
    Caller passes a buffer large enough for the max horizon (e.g. 25 for horizon=21).

    Args:
        conn:       psycopg3 connection.
        ticker:     market_history label (== ticker symbol).
        start_date: exclusive lower bound (bars strictly after this date).
        num_bars:   LIMIT cap; caller sets this to (max_horizon + buffer).
        interval:   market_history interval column (default '1d').

    Returns:
        Ascending list of (date, float) pairs; empty when no matching bars.
    """
    with conn.cursor() as cur:
        cur.execute(_RETURNS_WINDOW_SQL, (ticker, interval, start_date, num_bars))
        return [(row[0], float(row[1])) for row in cur.fetchall()]


def read_signal_events(
    conn: psycopg.Connection,
    since: date,
    limit: int = 5000,
    source: str = "all",
) -> list[tuple[str, str, date, str]]:
    """Yield (signal_type, ticker, event_date, direction) tuples from all signal sources.

    Sources:
      * politician_trades: buy → 'politician_buy'/'buy'; sell → 'politician_sell'/'sell'.
        Only equity trades with a non-null ticker and no soft-delete. Ordered by
        disclosure_date DESC, capped at ``limit``.
      * v_sec_position_delta joined security_map: is_new positions → '13f_new_position'/'buy'.
        Requires ticker from security_map and filing_date from sec_filings. Capped at ``limit``.

    Both queries are bounded by ``since`` (inclusive lower bound on the event date)
    and ``limit`` so a --limit/--since run stays bounded.

    Args:
        conn:  psycopg3 connection.
        since: inclusive lower bound on event_date (disclosure_date / filing_date).
        limit: per-source SQL LIMIT cap (default 5000).

    Returns:
        Combined list of (signal_type, ticker, event_date, direction) tuples.
        Deduplication is left to the caller (upsert handles idempotency).
    """
    events: list[tuple[str, str, date, str]] = []

    if source in ("all", "politician"):
        with conn.cursor() as cur:
            cur.execute(_POLITICIAN_EVENTS_SQL, (since, limit))
            events.extend(
                (str(sig), str(tick), row_date, str(direction))
                for sig, tick, row_date, direction in cur.fetchall()
            )

    if source not in ("all", "13f"):
        return events

    # Guard: mv_sec_new_positions (migration 0029) may be absent or empty (never
    # REFRESHed). Absent -> this block skips cleanly (politician axis still runs);
    # empty -> zero 13F events. Reading the materialized view is a fast indexed
    # scan (the live v_sec_position_delta self-join blew the pooler timeout).
    try:
        with conn.cursor() as cur:
            cur.execute(_SEC_NEW_POSITION_EVENTS_SQL, (since, limit))
            events.extend(
                (str(sig), str(tick), row_date, str(direction))
                for sig, tick, row_date, direction in cur.fetchall()
            )
    except Exception as exc:  # noqa: BLE001 — MV may be absent/unrefreshed
        conn.rollback()
        print(f"[read_signal_events] skipping 13f events ({type(exc).__name__}: {exc})")

    return events


def refresh_new_positions(conn: psycopg.Connection) -> bool:
    """REFRESH mv_sec_new_positions (Phase R.6). Best-effort — never raises.

    The underlying v_sec_position_delta self-join is expensive, so raise the
    per-statement timeout for this one offline op. Non-concurrent refresh
    (WITH NO DATA created empty; the first populate can't be CONCURRENT).
    Returns True on success, False if the MV is absent or the refresh fails.
    """
    try:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '600s'")
            cur.execute("REFRESH MATERIALIZED VIEW mv_sec_new_positions")
        conn.commit()
        return True
    except Exception as exc:  # noqa: BLE001 — MV may not exist (0029 unapplied)
        conn.rollback()
        print(f"[refresh_new_positions] skipped ({type(exc).__name__}: {exc})")
        return False


def upsert_signal_backtest(
    conn: psycopg.Connection,
    rows: "Sequence[SignalBacktestRow]",  # type: ignore[name-defined]  # noqa: F821
) -> int:
    """UPSERT signal_backtest rows in chunks. ON CONFLICT DO UPDATE (idempotent).

    Chunked so a full backtest (thousands of rows) is a handful of round-trips
    with one commit per chunk — a per-row commit loop kept the pooled connection
    open too long and was dropped mid-run ("connection is lost"). Chunk-level
    rollback isolates a bad chunk without aborting the rest.

    Args:
        conn: psycopg3 connection (prepare_threshold=None from connect()).
        rows: sequence of SignalBacktestRow (from collector.schema.rows).

    Returns:
        Count of rows submitted without error.
    """
    if not rows:
        return 0

    submitted = 0
    for start in range(0, len(rows), _UPSERT_CHUNK):
        chunk = rows[start:start + _UPSERT_CHUNK]
        try:
            with conn.cursor() as cur:
                cur.executemany(
                    _BACKTEST_UPSERT_SQL,
                    [(r.signal_type, r.ticker, r.as_of, r.horizon_days, r.car, r.is_hit)
                     for r in chunk],
                )
            conn.commit()
            submitted += len(chunk)
        except Exception as exc:  # noqa: BLE001 — chunk-level isolation
            conn.rollback()
            print(
                f"[upsert_signal_backtest] skipped chunk "
                f"[{start}:{start + len(chunk)}]: {type(exc).__name__}: {exc}"
            )
    return submitted


# --- Phase S: sector-relative benchmark reads --------------------------------

_SECTOR_MEMBERS_SQL = """
WITH ranked AS (
    SELECT
        f.symbol,
        f.shares_outstanding,
        h.bar_time::date   AS bar_date,
        h.close,
        ROW_NUMBER() OVER (PARTITION BY f.symbol ORDER BY h.bar_time ASC) AS rn
    FROM symbol_fundamentals f
    JOIN market_history h
        ON h.label    = f.symbol
        AND h.interval = %s
        AND h.bar_time > %s
    WHERE f.sector              = %s
      AND f.shares_outstanding IS NOT NULL
      AND f.deleted_at         IS NULL
)
SELECT symbol, shares_outstanding, bar_date, close
FROM   ranked
WHERE  rn <= %s
ORDER  BY symbol, bar_date ASC
"""


def read_sector_members(
    conn: psycopg.Connection,
    sector: str,
    start_date: date,
    num_bars: int,
    interval: str = DEFAULT_INTERVAL,
) -> dict[str, tuple[float, list[tuple[date, float]]]]:
    """Return {symbol: (shares_outstanding, ascending [(date, close)])} for sector.

    Fetches all active members (deleted_at IS NULL, shares_outstanding NOT NULL)
    whose market_history has bars strictly after start_date.  Uses a single SQL
    query with a per-symbol ROW_NUMBER cap (grouped in Python), cheap enough for
    per-event calls.

    Args:
        conn:       psycopg3 connection.
        sector:     sector string from symbol_fundamentals.sector.
        start_date: exclusive lower bound (bars strictly after this date).
        num_bars:   per-symbol LIMIT (same buffer as the stock price window).
        interval:   market_history interval column (default '1d').

    Returns:
        Dict of symbol -> (shares_outstanding, [(date, close)]); {} when no members.
    """
    result: dict[str, tuple[float, list[tuple[date, float]]]] = {}
    with conn.cursor() as cur:
        cur.execute(_SECTOR_MEMBERS_SQL, (interval, start_date, sector, num_bars))
        for symbol, shares, bar_date, close in cur.fetchall():
            sh = float(shares)
            if symbol not in result:
                result[symbol] = (sh, [])
            result[symbol][1].append((bar_date, float(close)))
    return result


_SYMBOL_SECTOR_SQL = """
SELECT sector
FROM   symbol_fundamentals
WHERE  symbol     = %s
  AND  deleted_at IS NULL
"""


def read_symbol_sector(conn: psycopg.Connection, ticker: str) -> str | None:
    """Return the sector string for ``ticker`` from symbol_fundamentals, or None.

    Returns None when the symbol is absent, soft-deleted, or has no sector set.

    Args:
        conn:   psycopg3 connection.
        ticker: symbol to look up.
    """
    with conn.cursor() as cur:
        cur.execute(_SYMBOL_SECTOR_SQL, (ticker,))
        row = cur.fetchone()
    return str(row[0]) if row and row[0] is not None else None
