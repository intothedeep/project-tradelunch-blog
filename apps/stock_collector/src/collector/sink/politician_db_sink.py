"""IO boundary: politician_registry + politician_trades Postgres writes (psycopg3 ONLY).

Purpose: idempotent UPSERTs for Phase Q kadoa congressional-trade disclosures.
  * upsert_politicians          -> politician_registry, basic columns only
  * upsert_politicians_enriched -> politician_registry, including Q10.2 aggregate cols
  * upsert_trades               -> politician_trades  ON CONFLICT(external_id) DO UPDATE
  * read_congress_filers        -> SELECT from politician_registry (non-executive rows)
  * update_bioguide_ids         -> SET bioguide_id on politician_registry by filer_id

Anti-clobber design (Q10.2):
  _POLITICIAN_SQL (trades path) lists only basic columns in both INSERT and SET.
  Because ON CONFLICT DO UPDATE touches ONLY the SET columns, the aggregate fields
  (photo_url, trade_count, purchases, sales, late_filings, est_volume) are
  untouched by the trades path even when a row already exists — no COALESCE
  trickery needed; the SQL simply does not mention those columns.
  _POLITICIAN_ENRICH_SQL (filers path) covers all columns and overwrites aggregates.

Foreign key constraint: politician_registry must be upserted BEFORE politician_trades
in each run (enforced by the entrypoint call order).

Invariants:
  * Caller is responsible for conn.commit() AFTER each function.
    (Both functions leave the transaction open so the entrypoint can batch or rollback.)
  * deleted_at is reset to NULL on re-upsert (revive soft-deleted rows).
  * updated_at is refreshed on every upsert touch.

Side effects: DB reads + writes (psycopg3).
"""

from __future__ import annotations

from collections.abc import Sequence

import psycopg

from collector.schema.rows import PoliticianRow, PoliticianTradeRow

# ---------------------------------------------------------------------------
# SQL templates
# ---------------------------------------------------------------------------

# Trades-path upsert: basic identity columns ONLY.
# Aggregate columns (photo_url … est_volume) are intentionally absent from
# both the INSERT list and the SET list so conflicts never clobber them.
_POLITICIAN_SQL = """
INSERT INTO politician_registry
    (filer_id, filer_name, party, chamber, branch, state, office, agency,
     bioguide_id, source)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (filer_id) DO UPDATE SET
    -- COALESCE(NULLIF(...)) so an empty/NULL value from per-filer detail rows
    -- (filer/{id}.json trades omit filer_name/party/etc — those live on the
    -- parent object) never clobbers a good value set by the filers.json
    -- enrichment path. Makes the two upsert paths order-independent.
    filer_name  = COALESCE(NULLIF(EXCLUDED.filer_name, ''), politician_registry.filer_name),
    party       = COALESCE(EXCLUDED.party,   politician_registry.party),
    chamber     = COALESCE(EXCLUDED.chamber, politician_registry.chamber),
    branch      = COALESCE(EXCLUDED.branch,  politician_registry.branch),
    state       = COALESCE(EXCLUDED.state,   politician_registry.state),
    office      = COALESCE(EXCLUDED.office,  politician_registry.office),
    agency      = COALESCE(EXCLUDED.agency,  politician_registry.agency),
    deleted_at  = NULL,
    updated_at  = now()
"""

# Filers-path upsert: all columns including Q10.2 aggregates.
_POLITICIAN_ENRICH_SQL = """
INSERT INTO politician_registry
    (filer_id, filer_name, party, chamber, branch, state, office, agency,
     bioguide_id, source,
     photo_url, trade_count, purchases, sales, late_filings, est_volume)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (filer_id) DO UPDATE SET
    filer_name   = EXCLUDED.filer_name,
    party        = EXCLUDED.party,
    chamber      = EXCLUDED.chamber,
    branch       = EXCLUDED.branch,
    state        = EXCLUDED.state,
    office       = EXCLUDED.office,
    agency       = EXCLUDED.agency,
    photo_url    = EXCLUDED.photo_url,
    trade_count  = EXCLUDED.trade_count,
    purchases    = EXCLUDED.purchases,
    sales        = EXCLUDED.sales,
    late_filings = EXCLUDED.late_filings,
    est_volume   = EXCLUDED.est_volume,
    deleted_at   = NULL,
    updated_at   = now()
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

# Read all non-executive registry rows (bioguide enrichment candidates).
_READ_CONGRESS_SQL = """
SELECT filer_id, filer_name, state, chamber, branch
FROM politician_registry
WHERE deleted_at IS NULL
  AND (
    branch IS NULL
    OR lower(branch) NOT IN ('executive', 'oge')
  )
  AND chamber IS NOT NULL
"""

# Update only the bioguide_id column; touches nothing else.
_UPDATE_BIOGUIDE_SQL = """
UPDATE politician_registry
SET bioguide_id = %s,
    updated_at  = now()
WHERE filer_id = %s
"""


# ---------------------------------------------------------------------------
# Public functions — caller commits
# ---------------------------------------------------------------------------


def upsert_politicians(conn: psycopg.Connection, rows: Sequence[PoliticianRow]) -> int:
    """UPSERT politician_registry rows (basic columns only). Caller must commit.

    Aggregate columns (photo_url … est_volume) are not mentioned in the SQL,
    so this function never clobbers values written by upsert_politicians_enriched.
    """
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


def upsert_politicians_enriched(conn: psycopg.Connection, rows: Sequence[PoliticianRow]) -> int:
    """UPSERT politician_registry rows including Q10.2 aggregate columns. Caller must commit.

    Use this for rows produced by parse_filers (filers.json enrichment path).
    Overwrites aggregate fields on conflict; safe to run repeatedly (idempotent).
    """
    if not rows:
        return 0
    params = [
        (
            r.filer_id, r.filer_name, r.party, r.chamber, r.branch,
            r.state, r.office, r.agency, r.bioguide_id, r.source,
            r.photo_url, r.trade_count, r.purchases, r.sales,
            r.late_filings, r.est_volume,
        )
        for r in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(_POLITICIAN_ENRICH_SQL, params)
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


def read_congress_filers(conn: psycopg.Connection) -> list[dict]:
    """SELECT all non-executive, non-deleted politician_registry rows.

    Returns a list of dicts with keys: filer_id, filer_name, state, chamber, branch.
    Used by enrich_bioguide to determine which filers need a bioguide_id lookup.

    Only rows where chamber IS NOT NULL and branch is not executive/OGE are returned
    because those are the only rows that can have a congress-legislators match.
    """
    with conn.cursor() as cur:
        cur.execute(_READ_CONGRESS_SQL)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def update_bioguide_ids(
    conn: psycopg.Connection,
    mapping: dict[str, str],
) -> int:
    """UPDATE bioguide_id for each filer_id in mapping. Caller must commit.

    Only touches the bioguide_id + updated_at columns — all other registry
    columns are left unchanged. Idempotent: re-running with the same mapping
    produces no net change.

    Args:
        conn:    open psycopg connection (caller commits).
        mapping: {filer_id: bioguide_id} for all matched filers.

    Returns:
        Number of rows passed to executemany (matched count).
    """
    if not mapping:
        return 0
    params = [(bioguide_id, filer_id) for filer_id, bioguide_id in mapping.items()]
    with conn.cursor() as cur:
        cur.executemany(_UPDATE_BIOGUIDE_SQL, params)
    return len(params)
