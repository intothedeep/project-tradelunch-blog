"""IO boundary: SEC 13F Postgres writes (psycopg3 ONLY here).

Split out of ``db_sink`` (SRP + ≤300 LOC): the SEC 13F domain (``sec_filings`` /
``sec_holdings``) is distinct from the market-data tables. Writes are idempotent
UPSERTs (``ON CONFLICT ... DO UPDATE``):
  * ``upsert_filings``  -> sec_filings  ON CONFLICT(cik, accession)
  * ``upsert_holdings`` -> sec_holdings ON CONFLICT(cik, accession, cusip, put_call, prn_type)
  * ``supersede_prior_filings`` -> soft-delete superseded same-period filings
    (strict-earlier filing_date guard; never downgrades a newer stored amendment)
  * ``supersede_period_others`` -> soft-delete by explicit keep_accessions list;
    used by the NEW HOLDINGS reconciliation path. Idempotent.
  * ``read_latest_period`` -> MAX(period_of_report) for cik (L19 period-advance guard)
  * ``read_all_periods``   -> all distinct period_of_report for cik (L18 prune candidates)
  * ``prune_period``       -> HARD-DELETE sec_holdings + sec_filings for (cik, period)
    EXCEPTION: this is a SANCTIONED hard-delete on DERIVED + ARCHIVED operational rows
    only (sec_holdings / sec_filings). It is NEVER applied to user-generated content.
    Owner sign-off: Phase L L18. Archive precondition enforced in prune_holdings entrypoint.

Connection management + insert_batch_log live in ``db_sink`` (callers pass conn).
Side effects: DB writes. Soft-delete only EXCEPT prune_period (see EXCEPTION above).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

import psycopg

from collector.schema.rows import FilingRow, HoldingRow

_FILINGS_SQL = """
INSERT INTO sec_filings
    (cik, accession, period_of_report, form_type, filer, filing_date, value_units, source)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (cik, accession) DO UPDATE SET
    period_of_report = EXCLUDED.period_of_report, form_type = EXCLUDED.form_type,
    filer = EXCLUDED.filer, filing_date = EXCLUDED.filing_date,
    value_units = EXCLUDED.value_units, deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
"""

_HOLDINGS_SQL = """
INSERT INTO sec_holdings
    (cik, accession, period_of_report, cusip, name_of_issuer, title_of_class,
     ticker, shares, prn_type, value_usd, put_call, discretion, source)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (cik, accession, cusip, put_call, prn_type) DO UPDATE SET
    period_of_report = EXCLUDED.period_of_report, name_of_issuer = EXCLUDED.name_of_issuer,
    title_of_class = EXCLUDED.title_of_class, shares = EXCLUDED.shares,
    value_usd = EXCLUDED.value_usd, discretion = EXCLUDED.discretion,
    deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
"""


def upsert_filings(conn: psycopg.Connection, rows: Sequence[FilingRow]) -> int:
    """UPSERT 13F filing headers -> sec_filings. Reviving (deleted_at=NULL) on
    re-upsert keeps a re-run of the kept filing idempotent. Idempotent."""
    if not rows:
        return 0
    params = [
        (r.cik, r.accession, r.period_of_report, r.form_type, r.filer,
         r.filing_date, r.value_units, r.source)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_FILINGS_SQL, params)
    conn.commit()
    return len(params)


def upsert_holdings(conn: psycopg.Connection, rows: Sequence[HoldingRow]) -> int:
    """UPSERT aggregated 13F positions -> sec_holdings. ``put_call``/``prn_type``
    are coerced to a NON-NULL sentinel ('') so the PK never hits Postgres'
    NULL-distinct rule (which would break ON CONFLICT). Idempotent."""
    if not rows:
        return 0
    params = [
        (r.cik, r.accession, r.period_of_report, r.cusip, r.name_of_issuer,
         r.title_of_class, r.ticker, r.shares, r.prn_type or "", r.value_usd,
         r.put_call or "", r.discretion, r.source)
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_HOLDINGS_SQL, params)
    conn.commit()
    return len(params)


def supersede_prior_filings(
    conn: psycopg.Connection,
    *,
    cik: str,
    period: date,
    keep_accession: str,
    keep_filing_date: date | None,
) -> int:
    """Soft-delete filings of the same (cik, period) that are SUPERSEDED by the
    kept one — but ONLY those filed STRICTLY EARLIER than ``keep_filing_date``.

    The strict-earlier guard prevents an out-of-order/missed-month re-run (where
    an older 13F-HR is fetched as 'latest') from clobbering a newer stored
    amendment. ``deleted_at IS NULL`` makes re-runs a clean no-op. Returns the
    number of holding rows tombstoned. No-op when ``keep_filing_date`` is None."""
    if keep_filing_date is None:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sec_holdings SET deleted_at = now(), updated_at = CURRENT_TIMESTAMP
            WHERE cik = %s AND period_of_report = %s AND deleted_at IS NULL
              AND accession <> %s
              AND accession IN (
                  SELECT accession FROM sec_filings
                  WHERE cik = %s AND period_of_report = %s AND filing_date < %s
              )
            """,
            (cik, period, keep_accession, cik, period, keep_filing_date),
        )
        n_holdings = cur.rowcount
        cur.execute(
            """
            UPDATE sec_filings SET deleted_at = now(), updated_at = CURRENT_TIMESTAMP
            WHERE cik = %s AND period_of_report = %s AND deleted_at IS NULL
              AND accession <> %s AND filing_date < %s
            """,
            (cik, period, keep_accession, keep_filing_date),
        )
    conn.commit()
    return n_holdings


def supersede_period_others(
    conn: psycopg.Connection,
    *,
    cik: str,
    period: date,
    keep_accessions: list[str],
) -> int:
    """Soft-delete holdings + filings for (cik, period) NOT in keep_accessions.

    Replaces the single-accession supersede_prior_filings for the NEW HOLDINGS
    reconciliation path, where multiple accessions (base + addenda) are all live.

    Idempotent: ``deleted_at IS NULL`` guard ensures repeated calls are no-ops.
    Parameterized: keep_accessions is passed as a Postgres array literal.

    Returns the number of holding rows tombstoned.
    """
    if not keep_accessions:
        # Safety: if keep list is empty, do NOT delete everything — no-op.
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sec_holdings SET deleted_at = now(), updated_at = CURRENT_TIMESTAMP
            WHERE cik = %s AND period_of_report = %s AND deleted_at IS NULL
              AND accession <> ALL(%s)
            """,
            (cik, period, keep_accessions),
        )
        n_holdings = cur.rowcount
        cur.execute(
            """
            UPDATE sec_filings SET deleted_at = now(), updated_at = CURRENT_TIMESTAMP
            WHERE cik = %s AND period_of_report = %s AND deleted_at IS NULL
              AND accession <> ALL(%s)
            """,
            (cik, period, keep_accessions),
        )
    conn.commit()
    return n_holdings


# --- L19 period-advance guard read -------------------------------------------


def read_latest_period(conn: psycopg.Connection, cik: str) -> date | None:
    """Return MAX(period_of_report) for cik in sec_holdings (active rows only).

    Table-guarded: returns None if the table is absent or no rows exist for
    this CIK. Used by run_monthly to skip the heavy infotable fetch when no
    new quarter is available (L19 period-advance guard).

    Pure read — no side effects.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT MAX(period_of_report)
                FROM sec_holdings
                WHERE cik = %s AND deleted_at IS NULL
                """,
                (cik,),
            )
            row = cur.fetchone()
            return row[0] if row and row[0] is not None else None
    except psycopg.errors.UndefinedTable:
        return None


# --- L18 prune helpers -------------------------------------------------------


def read_all_periods(conn: psycopg.Connection, cik: str) -> list[date]:
    """Return all distinct period_of_report dates for cik in sec_filings
    (active rows only, i.e. deleted_at IS NULL).

    Used by prune_holdings to enumerate candidate periods for hard-delete.
    Returns [] when no rows exist or table is absent.

    Pure read — no side effects.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT period_of_report
                FROM sec_filings
                WHERE cik = %s AND deleted_at IS NULL
                ORDER BY period_of_report ASC
                """,
                (cik,),
            )
            return [row[0] for row in cur.fetchall()]
    except psycopg.errors.UndefinedTable:
        return []


def prune_period(conn: psycopg.Connection, cik: str, period: date) -> tuple[int, int]:
    """HARD-DELETE sec_holdings + sec_filings rows for (cik, period_of_report).

    SANCTIONED EXCEPTION to the repo soft-delete rule — applies ONLY to derived +
    archived 13F operational rows. Owner sign-off: Phase L L18.
    Archive precondition (Parquet object-exists check) MUST be verified by the
    caller (prune_holdings entrypoint) BEFORE calling this function.
    NEVER call this on user-generated content.

    Deletes holdings first (FK dependency), then filings. Both are parameterized.
    Caller is responsible for conn.commit() after (allows batching or rollback).

    Returns:
        (n_holdings_deleted, n_filings_deleted)
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM sec_holdings WHERE cik = %s AND period_of_report = %s",
            (cik, period),
        )
        n_holdings = cur.rowcount
        cur.execute(
            "DELETE FROM sec_filings WHERE cik = %s AND period_of_report = %s",
            (cik, period),
        )
        n_filings = cur.rowcount
    return n_holdings, n_filings
