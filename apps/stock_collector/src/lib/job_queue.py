"""SQLite-backed job queue (raw SQL, stdlib sqlite3).

One DB serves both Massive (formerly Polygon) and Alpaca pipelines. The queue tracks job state
only; downloaded OHLCV data stays as CSV files under data/<provider>/ (e.g.
data/massive/, data/alpaca/). There are deliberately no price/volume columns
in the schema.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Optional, TypedDict

__all__ = [
    "JobRow",
    "DEFAULT_DB_PATH",
    "get_db_path",
    "connect",
    "init_db",
    "enqueue",
    "enqueue_bulk",
    "claim_next",
    "claim_next_batch",
    "mark_done",
    "mark_failed",
    "requeue_failed",
    "reset_stale",
    "status_counts",
    "list_by_status",
    "preseed_done",
]


class JobRow(TypedDict):
    id: int
    provider: str
    ticker: str
    from_date: str
    to_date: str
    status: str
    retry_count: int
    error_msg: Optional[str]
    record_count: Optional[int]
    created_at: str
    updated_at: str


DEFAULT_DB_PATH = "queue/jobs.db"

_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"

_CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    provider     TEXT    NOT NULL,
    ticker       TEXT    NOT NULL,
    from_date    TEXT    NOT NULL,
    to_date      TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','done','failed')),
    retry_count  INTEGER NOT NULL DEFAULT 0,
    error_msg    TEXT,
    record_count INTEGER,
    created_at   TEXT    NOT NULL DEFAULT ({_NOW}),
    updated_at   TEXT    NOT NULL DEFAULT ({_NOW}),
    UNIQUE (provider, ticker, from_date, to_date)
);
"""

_CREATE_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_provider_status ON jobs(provider, status);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_status_updated ON jobs(status, updated_at);",
)

_INSERT_PENDING = """
INSERT INTO jobs (provider, ticker, from_date, to_date, status)
VALUES (?, ?, ?, ?, 'pending')
ON CONFLICT (provider, ticker, from_date, to_date) DO NOTHING;
"""

_CLAIM_NEXT = f"""
UPDATE jobs
   SET status = 'in_progress',
       updated_at = {_NOW}
 WHERE id = (
     SELECT id FROM jobs
      WHERE status = 'pending'
        AND (:provider IS NULL OR provider = :provider)
      ORDER BY id LIMIT 1
 )
RETURNING *;
"""

_CLAIM_NEXT_BATCH = f"""
UPDATE jobs
   SET status = 'in_progress',
       updated_at = {_NOW}
 WHERE id IN (
     SELECT id FROM jobs
      WHERE status = 'pending'
        AND (:provider IS NULL OR provider = :provider)
      ORDER BY id LIMIT :limit
 )
RETURNING *;
"""

_MARK_DONE = f"""
UPDATE jobs SET status='done', record_count=?, error_msg=NULL,
    updated_at={_NOW} WHERE id=?;
"""

_MARK_FAILED = f"""
UPDATE jobs SET status='failed', retry_count=retry_count+1, error_msg=?,
    updated_at={_NOW} WHERE id=?;
"""

_REQUEUE_FAILED = f"""
UPDATE jobs SET status='pending', updated_at={_NOW}
 WHERE status='failed' AND retry_count < ?;
"""

_RESET_STALE = f"""
UPDATE jobs SET status='pending', updated_at={_NOW}
 WHERE status='in_progress'
   AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', '-' || ? || ' seconds');
"""

_STATUS_COUNTS = """
SELECT status, COUNT(*) AS n FROM jobs
 WHERE (:provider IS NULL OR provider = :provider) GROUP BY status;
"""

_LIST_BY_STATUS = """
SELECT * FROM jobs
 WHERE status = :status AND (:provider IS NULL OR provider = :provider)
 ORDER BY id LIMIT :limit;
"""

_PRESEED_DONE = """
INSERT INTO jobs (provider, ticker, from_date, to_date, status, record_count)
VALUES (?, ?, ?, ?, 'done', 0)
ON CONFLICT (provider, ticker, from_date, to_date) DO NOTHING;
"""

_ERROR_MAX_LEN = 1000
_ALL_STATUSES = ("pending", "in_progress", "done", "failed")


def _repo_root() -> Path:
    # src/lib/job_queue.py -> parents[0]=lib, [1]=src, [2]=repo root
    return Path(__file__).resolve().parents[2]


def get_db_path(db_path: Optional[str] = None) -> Path:
    """Resolve the DB path: explicit arg > JOBS_DB_PATH env > repo-relative default."""
    if db_path is not None:
        return Path(db_path)
    env = os.getenv("JOBS_DB_PATH")
    if env:
        return Path(env)
    return _repo_root() / DEFAULT_DB_PATH


def connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Open a connection (manual transactions), apply PRAGMAs, init schema."""
    path = get_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    init_db(conn)
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Create the jobs table and indexes if absent. Idempotent."""
    conn.execute(_CREATE_TABLE)
    for stmt in _CREATE_INDEXES:
        conn.execute(stmt)


def _row_to_job(row: sqlite3.Row) -> JobRow:
    return JobRow(
        id=row["id"],
        provider=row["provider"],
        ticker=row["ticker"],
        from_date=row["from_date"],
        to_date=row["to_date"],
        status=row["status"],
        retry_count=row["retry_count"],
        error_msg=row["error_msg"],
        record_count=row["record_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def enqueue(
    conn: sqlite3.Connection,
    provider: str,
    ticker: str,
    from_date: str,
    to_date: str,
) -> bool:
    """Insert one pending job. Returns True if inserted, False if deduped."""
    cur = conn.execute(_INSERT_PENDING, (provider, ticker, from_date, to_date))
    return cur.rowcount > 0


def enqueue_bulk(
    conn: sqlite3.Connection,
    provider: str,
    jobs: list[tuple[str, str, str]],
) -> int:
    """Bulk insert pending jobs in one transaction. Returns inserted row count."""
    if not jobs:
        return 0
    rows = [
        (provider, ticker, from_date, to_date) for ticker, from_date, to_date in jobs
    ]
    conn.execute("BEGIN IMMEDIATE;")
    try:
        before = conn.total_changes
        conn.executemany(_INSERT_PENDING, rows)
        inserted = conn.total_changes - before
        conn.execute("COMMIT;")
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    return inserted


def claim_next(
    conn: sqlite3.Connection, provider: Optional[str] = None
) -> Optional[JobRow]:
    """Atomically claim one pending job -> in_progress. Returns it or None."""
    conn.execute("BEGIN IMMEDIATE;")
    try:
        cur = conn.execute(_CLAIM_NEXT, {"provider": provider})
        row = cur.fetchone()
        conn.execute("COMMIT;")
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    if row is None:
        return None
    return _row_to_job(row)


def claim_next_batch(
    conn: sqlite3.Connection,
    provider: Optional[str] = None,
    limit: int = 100,
) -> list[JobRow]:
    """Atomically claim up to `limit` pending jobs -> in_progress.

    Returns the claimed rows (possibly empty), ordered by id. Mirrors
    claim_next's BEGIN IMMEDIATE + RETURNING * pattern for N rows so
    concurrent workers never grab the same job.
    """
    if limit <= 0:
        return []
    conn.execute("BEGIN IMMEDIATE;")
    try:
        cur = conn.execute(_CLAIM_NEXT_BATCH, {"provider": provider, "limit": limit})
        rows = cur.fetchall()
        conn.execute("COMMIT;")
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    return [_row_to_job(row) for row in rows]


def mark_done(conn: sqlite3.Connection, job_id: int, record_count: int) -> None:
    """Mark a job done and store its record count."""
    conn.execute(_MARK_DONE, (record_count, job_id))


def mark_failed(conn: sqlite3.Connection, job_id: int, error_msg: str) -> None:
    """Mark a job failed, increment retry_count, store (truncated) error."""
    conn.execute(_MARK_FAILED, (error_msg[:_ERROR_MAX_LEN], job_id))


def requeue_failed(conn: sqlite3.Connection, max_retries: int) -> int:
    """Requeue failed jobs below the retry threshold. Returns affected count."""
    cur = conn.execute(_REQUEUE_FAILED, (max_retries,))
    return cur.rowcount


def reset_stale(conn: sqlite3.Connection, timeout_seconds: int) -> int:
    """Reset in_progress jobs older than timeout to pending. Returns count."""
    cur = conn.execute(_RESET_STALE, (timeout_seconds,))
    return cur.rowcount


def status_counts(
    conn: sqlite3.Connection, provider: Optional[str] = None
) -> dict[str, int]:
    """Return per-status counts with all four status keys present (default 0)."""
    counts: dict[str, int] = {status: 0 for status in _ALL_STATUSES}
    cur = conn.execute(_STATUS_COUNTS, {"provider": provider})
    for row in cur.fetchall():
        counts[row["status"]] = row["n"]
    return counts


def list_by_status(
    conn: sqlite3.Connection,
    status: str,
    provider: Optional[str] = None,
    limit: int = 100,
) -> list[JobRow]:
    """List jobs with the given status, ordered by id, up to limit."""
    cur = conn.execute(
        _LIST_BY_STATUS,
        {"status": status, "provider": provider, "limit": limit},
    )
    return [_row_to_job(row) for row in cur.fetchall()]


def preseed_done(
    conn: sqlite3.Connection,
    provider: str,
    items: list[tuple[str, str, str]],
) -> int:
    """Insert already-completed jobs as done (migration safety). Returns inserted."""
    if not items:
        return 0
    rows = [
        (provider, ticker, from_date, to_date) for ticker, from_date, to_date in items
    ]
    conn.execute("BEGIN IMMEDIATE;")
    try:
        before = conn.total_changes
        conn.executemany(_PRESEED_DONE, rows)
        inserted = conn.total_changes - before
        conn.execute("COMMIT;")
    except Exception:
        conn.execute("ROLLBACK;")
        raise
    return inserted
