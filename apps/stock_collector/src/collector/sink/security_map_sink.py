"""IO boundary: security_map Postgres reads/writes (psycopg3 ONLY here).

Phase P (STEP 0-b). Bridges 13F CUSIPs to tickers so signals can join the three
data axes. Three operations:
  * select_candidate_cusips -> the ever-top-N CUSIPs (last N quarters) still
    needing resolution (unresolved AND under the retry cap).
  * upsert_security_map     -> ON CONFLICT(cusip) UPSERT of resolution outcomes;
    bumps attempt_count every attempt so permanently-unmappable CUSIPs age out.
  * copy_sector_from_fundamentals -> cache ticker->sector from symbol_fundamentals.

Resolution rows come from the pure ``transform/cusip_resolve`` module. Connection
management + insert_batch_log live in ``db_sink`` (callers pass conn).
Side effects: DB writes. Soft-delete only (no hard-delete here).
"""

from __future__ import annotations

from collections.abc import Sequence

import psycopg

from collector.transform.cusip_resolve import ResolvedSecurity

# Ever-top-N (per cik, per quarter) CUSIPs over the recent quarters, restricted to
# common-stock long positions, minus any already resolved or over the retry cap.
_CANDIDATES_SQL = """
WITH recent_periods AS (
    SELECT DISTINCT period_of_report
    FROM sec_holdings
    WHERE deleted_at IS NULL
    ORDER BY period_of_report DESC
    LIMIT %(quarters)s
),
ranked AS (
    SELECT cusip,
           ROW_NUMBER() OVER (
               PARTITION BY cik, period_of_report ORDER BY value_usd DESC
           ) AS rn
    FROM sec_holdings
    WHERE deleted_at IS NULL AND put_call = '' AND prn_type <> 'PRN'
      AND period_of_report IN (SELECT period_of_report FROM recent_periods)
)
SELECT DISTINCT r.cusip
FROM ranked r
WHERE r.rn <= %(top_n)s
  AND NOT EXISTS (
      SELECT 1 FROM security_map m
      WHERE m.cusip = r.cusip AND m.deleted_at IS NULL
        AND (m.resolved_at IS NOT NULL OR m.attempt_count >= %(max_attempts)s)
  )
ORDER BY r.cusip
"""

_UPSERT_SQL = """
INSERT INTO security_map
    (cusip, ticker, name, source, confidence, resolved_at, attempt_count, last_attempt_at)
VALUES
    (%s, %s, %s, %s, %s, CASE WHEN %s THEN now() ELSE NULL END, 1, now())
ON CONFLICT (cusip) DO UPDATE SET
    ticker = COALESCE(EXCLUDED.ticker, security_map.ticker),
    name = COALESCE(EXCLUDED.name, security_map.name),
    source = EXCLUDED.source,
    confidence = EXCLUDED.confidence,
    resolved_at = COALESCE(EXCLUDED.resolved_at, security_map.resolved_at),
    attempt_count = security_map.attempt_count + 1,
    last_attempt_at = now(),
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
"""

_COPY_SECTOR_SQL = """
UPDATE security_map m SET sector = f.sector, updated_at = CURRENT_TIMESTAMP
FROM symbol_fundamentals f
WHERE f.symbol = m.ticker AND f.deleted_at IS NULL
  AND m.ticker IS NOT NULL AND m.deleted_at IS NULL
  AND m.sector IS DISTINCT FROM f.sector
"""

_SOURCE = "openfigi"


def select_candidate_cusips(
    conn: psycopg.Connection,
    *,
    quarters: int = 8,
    top_n: int = 50,
    max_attempts: int = 5,
) -> list[str]:
    """Return CUSIPs needing resolution: ever-top-N over the recent quarters.

    Restricted to long equity positions (put_call='', prn_type<>'PRN' — matches
    the rankflow serving filter so every served CUSIP is a resolve candidate) and
    excluding CUSIPs already resolved or past ``max_attempts`` failed tries.
    Table-guarded — returns [] if sec_holdings/security_map is absent.

    Pure read — no side effects.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                _CANDIDATES_SQL,
                {"quarters": quarters, "top_n": top_n, "max_attempts": max_attempts},
            )
            return [row[0] for row in cur.fetchall()]
    except psycopg.errors.UndefinedTable:
        return []


def upsert_security_map(conn: psycopg.Connection, rows: Sequence[ResolvedSecurity]) -> int:
    """UPSERT resolution outcomes -> security_map ON CONFLICT(cusip).

    Every call bumps attempt_count + stamps last_attempt_at, so unmappable CUSIPs
    age toward the retry cap. Resolved rows (ticker present) set resolved_at=now();
    unresolved rows leave resolved_at NULL so they stay retry candidates.
    Idempotent-safe. Returns the number of rows written."""
    if not rows:
        return 0
    params = [
        (r.cusip, r.ticker, r.name, _SOURCE, r.confidence, r.ticker is not None)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_UPSERT_SQL, params)
    conn.commit()
    return len(params)


def copy_sector_from_fundamentals(conn: psycopg.Connection) -> int:
    """Cache ticker->sector from symbol_fundamentals into resolved security_map rows.

    sector is nearly immutable, so a stale cached value is acceptable; the
    enriched view still prefers live symbol_fundamentals.sector at read time.
    Table-guarded. Returns the number of rows updated."""
    try:
        with conn.cursor() as cur:
            cur.execute(_COPY_SECTOR_SQL)
            n = cur.rowcount
        conn.commit()
        return n
    except psycopg.errors.UndefinedTable:
        return 0
