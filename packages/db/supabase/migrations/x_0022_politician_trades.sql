-- =============================================================================
-- Migration: 0022_politician_trades.sql
-- Purpose   : US congressional + executive STOCK Act disclosures (PTR / OGE
--             278-T event stream). Two tables — politician_registry (filer
--             metadata) + politician_trades (per-transaction event rows) —
--             mirrored from kadoa-org/congress-trading-monitor (MIT license).
--             Source data is US public record; governed by federal statute
--             5 U.S.C. §13107(c). Commercial use restricted to news/media
--             dissemination — keep product free/editorial. Lawyer review
--             required before any paid monetization of this data.
-- Provenance: every row carries source='kadoa' (non-authoritative mirror).
--             Official House Clerk bulk-download self-parse may replace kadoa
--             as authoritative source in a later phase; the external_id key
--             and the source column allow a clean cut-over.
-- Note      : MANUAL — apply by hand AFTER 0021. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

-- One row per unique filer (politician or executive branch official).
CREATE TABLE IF NOT EXISTS politician_registry (
    filer_id        TEXT NOT NULL,                       -- kadoa filer slug (PK)
    filer_name      TEXT NOT NULL,
    party           TEXT NULL,                           -- 'D'|'R'|'I'
    chamber         TEXT NULL,                           -- 'house'|'senate'
    branch          TEXT NULL,                           -- 'congress'|'executive'
    state           TEXT NULL,
    office          TEXT NULL,
    agency          TEXT NULL,
    bioguide_id     TEXT NULL,                           -- reserved: congress-legislators enrichment
    source          TEXT NOT NULL DEFAULT 'kadoa',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT politician_registry_pkey PRIMARY KEY (filer_id)
);

-- One row per disclosed transaction event (NOT a holdings snapshot).
-- external_id = kadoa `id` field; globally unique → the dedup/upsert key.
-- value_min/max are whole USD (kadoa amount_range_low/high). value_estimate
-- is the geometric-mean midpoint computed by the collector.
CREATE TABLE IF NOT EXISTS politician_trades (
    external_id          TEXT NOT NULL,                  -- kadoa id; dedup/upsert key
    filer_id             TEXT NOT NULL,                  -- FK → politician_registry(filer_id)
    disclosure_date      DATE NOT NULL,                  -- kadoa filing_date; the signal date
    transaction_date     DATE NULL,                      -- kadoa transaction_date
    transaction_type     TEXT NOT NULL,                  -- normalized 'buy'|'sell'|'exchange'
    transaction_type_raw TEXT NULL,                      -- kadoa original (Purchase / Sale (Full) / Sale (Partial) / Exchange)
    filer_owner          TEXT NULL,                      -- normalized 'self'|'spouse'|'dependent'|'joint'
    owner_raw            TEXT NULL,                      -- kadoa original (Self/SP/Spouse/JT/Joint/Child/DC)
    asset_type           TEXT NOT NULL DEFAULT 'other',  -- 'equity'|'bond'|'option'|'other'
    asset_type_raw       TEXT NULL,                      -- kadoa code (CS/PS/GS/OP/...) — source-representation-first
    ticker               TEXT NULL,                      -- Yahoo-normalized; NULL when unmappable (~42%)
    asset_name           TEXT NULL,
    value_min            BIGINT NULL,                    -- kadoa amount_range_low (whole USD)
    value_max            BIGINT NULL,                    -- kadoa amount_range_high (whole USD)
    value_estimate       BIGINT NULL,                    -- geometric-mean midpoint (computed by collector)
    value_label          TEXT NULL,                      -- kadoa amount_range_label
    doc_url              TEXT NULL,
    source_id            TEXT NULL,                      -- 'house_clerk'|'senate_efd'|'oge'
    filing_type          TEXT NULL,                      -- 'PTR'|'278-T'
    days_to_file         INT NULL,
    is_late              BOOLEAN NULL,
    source               TEXT NOT NULL DEFAULT 'kadoa',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ NULL,
    CONSTRAINT politician_trades_pkey PRIMARY KEY (external_id),
    CONSTRAINT politician_trades_filer_fk
        FOREIGN KEY (filer_id) REFERENCES politician_registry(filer_id)
);

-- Partial indexes (active rows only).
CREATE INDEX IF NOT EXISTS idx_politician_trades_ticker_disc
    ON politician_trades(ticker, disclosure_date DESC)
    WHERE deleted_at IS NULL AND ticker IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_politician_trades_disc
    ON politician_trades(disclosure_date DESC)
    WHERE deleted_at IS NULL;

-- Enriched read surface: trade rows + filer metadata + sector enrichment.
-- Sector prefers live symbol_fundamentals, falls back to security_map cached
-- sector — mirrors the COALESCE(f.sector, m.sector) idiom in v_sec_holdings_enriched.
CREATE OR REPLACE VIEW v_politician_trades_enriched AS
SELECT pt.*,
       r.filer_name,
       r.party,
       r.chamber,
       r.branch,
       sm.sector                        AS map_sector,
       COALESCE(f.sector, sm.sector)    AS sector
FROM politician_trades pt
LEFT JOIN politician_registry r
       ON r.filer_id = pt.filer_id AND r.deleted_at IS NULL
LEFT JOIN security_map sm
       ON sm.ticker = pt.ticker AND sm.deleted_at IS NULL
LEFT JOIN symbol_fundamentals f
       ON f.symbol = pt.ticker AND f.deleted_at IS NULL
WHERE pt.deleted_at IS NULL;

-- Aggregate activity per ticker over a rolling 90-day disclosure window.
-- 'exchange' transactions are counted in traded_by_count but excluded from
-- buy/sell member counts (the FILTER WHERE clauses naturally handle this).
-- cluster_flag = TRUE when 3+ distinct members bought OR 3+ distinct members
-- sold within the window — a cluster is a potential front-run signal.
CREATE OR REPLACE VIEW v_politician_activity AS
SELECT
    ticker,
    -- keyed on kadoa filer_id (not bioguide_id, which is not yet populated);
    -- may slightly over-count a politician whose slug varies across sources —
    -- reconcile at bioguide enrichment.
    COUNT(DISTINCT filer_id)                                                    AS traded_by_count,
    COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'buy')            AS buy_member_count,
    COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'sell')           AS sell_member_count,
    CASE
        WHEN COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'buy')
           > COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy_skew'
        WHEN COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'sell')
           > COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell_skew'
        ELSE 'mixed'
    END                                                                          AS net_direction,
    MAX(disclosure_date)                                                         AS latest_disclosure_date,
    (
        COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'buy')  >= 3
        OR
        COUNT(DISTINCT filer_id) FILTER (WHERE transaction_type = 'sell') >= 3
    )                                                                            AS cluster_flag
FROM politician_trades
WHERE ticker IS NOT NULL
  AND deleted_at IS NULL
  AND disclosure_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY ticker;
