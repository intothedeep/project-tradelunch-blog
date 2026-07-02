"""IO boundary: politician_registry + politician_trades Postgres writes (psycopg3 ONLY).

Purpose: idempotent UPSERTs for Phase Q kadoa congressional-trade disclosures.
  * upsert_politicians -> politician_registry  ON CONFLICT(filer_id) DO UPDATE
  * upsert_trades      -> politician_trades    ON CONFLICT(external_id) DO UPDATE

Foreign key constraint: politician_registry must be upserted BEFORE politician_trades
in each run (enforced by the entrypoint call order).

Invariants:
  * Caller is responsible for conn.commit() AFTER each function.
    (Both functions leave the transaction open so the entrypoint can batch or rollback.)
  * deleted_at is reset to NULL on re-upsert (revive soft-deleted rows).
  * updated_at is refreshed on every upsert touch.

Side effects: DB writes (psycopg3).
"""

from __future__ import annotations

from collections.abc import Sequence

import psycopg

from collector.schema.rows import PoliticianRow, PoliticianTradeRow

# ---------------------------------------------------------------------------
# SQL templates
# ---------------------------------------------------------------------------

_POLITICIAN_SQL = """
INSERT INTO politician_registry
    (filer_id, filer_name, party, chamber, branch, state, office, agency,
     bioguide_id, source)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (filer_id) DO UPDATE SET
    filer_name  = EXCLUDED.filer_name,
    party       = EXCLUDED.party,
    chamber     = EXCLUDED.chamber,
    branch      = EXCLUDED.branch,
    state       = EXCLUDED.state,
    office      = EXCLUDED.office,
    agency      = EXCLUDED.agency,
    deleted_at  = NULL,
    updated_at  = now()
"""

_TRADE_SQL = """
INSERT INTO politician_trades
    (external_id, filer_id, disclosure_date, transaction_date,
     transaction_type, transaction_type_raw,
     filer_owner, owner_raw,
     asset_type, asset_type_raw,
     ticker, asset_name,
     value_min, value_max, value_estimate, value_label,
     doc_url, source_id, filing_type, days_to_file, is_late, source)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (external_id) DO UPDATE SET
    filer_id             = EXCLUDED.filer_id,
    disclosure_date      = EXCLUDED.disclosure_date,
    transaction_date     = EXCLUDED.transaction_date,
    transaction_type     = EXCLUDED.transaction_type,
    transaction_type_raw = EXCLUDED.transaction_type_raw,
    filer_owner          = EXCLUDED.filer_owner,
    owner_raw            = EXCLUDED.owner_raw,
    asset_type           = EXCLUDED.asset_type,
    asset_type_raw       = EXCLUDED.asset_type_raw,
    ticker               = EXCLUDED.ticker,
    asset_name           = EXCLUDED.asset_name,
    value_min            = EXCLUDED.value_min,
    value_max            = EXCLUDED.value_max,
    value_estimate       = EXCLUDED.value_estimate,
    value_label          = EXCLUDED.value_label,
    doc_url              = EXCLUDED.doc_url,
    source_id            = EXCLUDED.source_id,
    filing_type          = EXCLUDED.filing_type,
    days_to_file         = EXCLUDED.days_to_file,
    is_late              = EXCLUDED.is_late,
    deleted_at           = NULL,
    updated_at           = now()
"""


# ---------------------------------------------------------------------------
# Public functions — caller commits
# ---------------------------------------------------------------------------


def upsert_politicians(conn: psycopg.Connection, rows: Sequence[PoliticianRow]) -> int:
    """UPSERT politician_registry rows. Caller must commit. Idempotent."""
    if not rows:
        return 0
    params = [
        (
            r.filer_id, r.filer_name, r.party, r.chamber, r.branch,
            r.state, r.office, r.agency, r.bioguide_id, r.source,
        )
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_POLITICIAN_SQL, params)
    return len(params)


def upsert_trades(conn: psycopg.Connection, rows: Sequence[PoliticianTradeRow]) -> int:
    """UPSERT politician_trades rows. Caller must commit. Idempotent.

    Requires politician_registry rows to already be committed before calling
    (FK constraint: politician_trades.filer_id -> politician_registry.filer_id).
    """
    if not rows:
        return 0
    params = [
        (
            r.external_id, r.filer_id, r.disclosure_date, r.transaction_date,
            r.transaction_type, r.transaction_type_raw,
            r.filer_owner, r.owner_raw,
            r.asset_type, r.asset_type_raw,
            r.ticker, r.asset_name,
            r.value_min, r.value_max, r.value_estimate, r.value_label,
            r.doc_url, r.source_id, r.filing_type, r.days_to_file, r.is_late,
            r.source,
        )
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_TRADE_SQL, params)
    return len(params)
