"""IO boundary: SEC 13F Postgres writes (psycopg3 ONLY here).

Split out of ``db_sink`` (SRP + ≤300 LOC): the SEC 13F domain (``sec_filings`` /
``sec_holdings``) is distinct from the market-data tables. Writes are idempotent
UPSERTs (``ON CONFLICT ... DO UPDATE``):
  * ``upsert_filings``  -> sec_filings  ON CONFLICT(cik, accession)
  * ``upsert_holdings`` -> sec_holdings ON CONFLICT(cik, accession, cusip, put_call, prn_type)
  * ``supersede_prior_filings`` -> soft-delete superseded same-period filings
    (strict-earlier filing_date guard; never downgrades a newer stored amendment)

Connection management + insert_batch_log live in ``db_sink`` (callers pass conn).
Side effects: DB writes. Soft-delete only (never hard-DELETE).
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
