"""IO boundary: GEX daily table Postgres writes (psycopg3 ONLY here).

Mirrors db_sink.py's connect() / chunked executemany / insert_batch_log patterns.

  * upsert_gex_daily  -> gex_daily  ON CONFLICT (as_of, ticker) DO UPDATE

Soft-delete aware: rows are never hard-deleted; deleted_at remains NULL after
an upsert, reviving any previously soft-deleted row.

Side effects: DB connection + writes.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

import psycopg

from collector.config.settings import database_url
from collector.schema.chain_rows import GexDailyRow

__all__ = ["connect", "upsert_gex_daily"]

# rows per executemany/commit — bounds round-trips + connection lifetime
_UPSERT_CHUNK = 500

_GEX_UPSERT_SQL = """
INSERT INTO gex_daily
    (as_of, ticker, net_gex, call_gex, put_gex, spot, source)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (as_of, ticker) DO UPDATE SET
    net_gex    = EXCLUDED.net_gex,
    call_gex   = EXCLUDED.call_gex,
    put_gex    = EXCLUDED.put_gex,
    spot       = EXCLUDED.spot,
    source     = EXCLUDED.source,
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
"""

_BATCH_LOG_SQL = """
INSERT INTO batch_log (job, status, resolved, started_at, finished_at, descr)
VALUES (%s, %s, %s, %s, %s, %s)
"""


def connect() -> psycopg.Connection:
    """Open a psycopg3 connection to the Supabase session pooler.

    Pins timezone=UTC (gex_daily.as_of is DATE, consistent with other tables).
    prepare_threshold=None disables server-side auto-prepare: the Supabase
    pooler rotates underlying connections, so a prepared statement disappears
    between executemany calls → InvalidSqlStatementName. This is the
    pooler-safe setting used across all collector sinks.
    """
    dsn = database_url()
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(dsn, options="-c timezone=UTC", prepare_threshold=None)


def upsert_gex_daily(
    conn: psycopg.Connection,
    rows: Sequence[GexDailyRow],
) -> int:
    """UPSERT GexDailyRow list into gex_daily in chunks.

    Idempotent: ON CONFLICT (as_of, ticker) DO UPDATE overwrites numeric columns.
    Chunk-level rollback isolates a bad chunk without aborting the rest.

    Args:
        conn: psycopg3 connection (prepare_threshold=None from connect()).
        rows: sequence of GexDailyRow.

    Returns:
        Count of rows submitted without error.
    """
    if not rows:
        return 0

    submitted = 0
    for start in range(0, len(rows), _UPSERT_CHUNK):
        chunk = rows[start : start + _UPSERT_CHUNK]
        try:
            with conn.cursor() as cur:
                cur.executemany(
                    _GEX_UPSERT_SQL,
                    [
                        (r.as_of, r.ticker, r.net_gex, r.call_gex, r.put_gex, r.spot, r.source)
                        for r in chunk
                    ],
                )
            conn.commit()
            submitted += len(chunk)
        except Exception as exc:  # noqa: BLE001 — chunk-level isolation
            conn.rollback()
            print(
                f"[gex_sink] skipped chunk [{start}:{start + len(chunk)}]: "
                f"{type(exc).__name__}: {exc}"
            )
    return submitted


def insert_batch_log(
    conn: psycopg.Connection,
    *,
    job: str,
    status: str,
    started_at: datetime,
    finished_at: datetime,
    descr: str,
) -> bool:
    """Best-effort: append ONE batch-run row. NEVER raises.

    Rolls back first to clear any aborted tx from a failed run, so the
    failure row itself still lands. ``success`` → resolved=1, else 0.
    """
    resolved = 1 if status == "success" else 0
    try:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
                _BATCH_LOG_SQL,
                (job, status, resolved, started_at, finished_at, descr),
            )
        conn.commit()
        return True
    except Exception as exc:  # noqa: BLE001 — op log, must never abort the job
        conn.rollback()
        print(f"[gex_sink][batch_log] skipped ({type(exc).__name__}: {exc})")
        return False
