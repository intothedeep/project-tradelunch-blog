-- =============================================================================
-- Migration: 0019_security_map.sql
-- Purpose   : CUSIP -> ticker -> sector join key (Phase P, STEP 0-b). SEC 13F
--             holdings (sec_holdings) are CUSIP-only; market_rankings /
--             market_history / symbol_fundamentals are ticker-only. This table
--             bridges the two so every investment signal (consensus, screener,
--             /symbols) can join across the three data axes.
-- Fill      : written weekly by apps/stock_collector (run_security_map,
--             job='collector-secmap') via OpenFIGI /v3/mapping (CUSIP->ticker)
--             + symbol_fundamentals (ticker->sector). Empty until that runs.
-- Note      : MANUAL — apply by hand AFTER 0018. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- Soft-delete: deleted_at tombstone (domain data). Unresolved CUSIPs keep
--             resolved_at = NULL and are retried up to an attempt cap; the
--             collector never hard-deletes rows here.
-- Join rule : reads go through v_sec_holdings_enriched, NOT a backfill of
--             sec_holdings.ticker — amendment re-ingest re-inserts holdings with
--             ticker NULL, so a stored ticker would drift. The view keeps the
--             mapping mutable and retroactive across all quarters.
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_map (
    cusip           TEXT NOT NULL,                    -- 9-char, source-native (13F key)
    ticker          TEXT NULL,                        -- Yahoo-normalized (BRK-B, not BRK/B)
    name            TEXT NULL,                         -- OpenFIGI security name
    sector          TEXT NULL,                         -- cached from symbol_fundamentals at resolve time
    source          TEXT NOT NULL DEFAULT 'openfigi', -- 'openfigi' | 'manual'
    confidence      TEXT NOT NULL DEFAULT 'exact',    -- 'exact' | 'unresolved' | 'manual'
    resolved_at     TIMESTAMPTZ NULL,                 -- NULL = unresolved (retry candidate)
    attempt_count   INT NOT NULL DEFAULT 0,           -- caps retries on permanently-unmappable CUSIPs
    last_attempt_at TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT security_map_pkey PRIMARY KEY (cusip)
);

CREATE INDEX IF NOT EXISTS idx_security_map_ticker
    ON security_map(ticker) WHERE deleted_at IS NULL AND ticker IS NOT NULL;

-- Enriched read surface: 13F holdings + resolved ticker + sector. sector prefers
-- live symbol_fundamentals, falls back to the mapping-time cached sector. Rows
-- whose CUSIP is unresolved surface mapped_ticker = NULL (naturally excluded from
-- signal math, which requires a ticker).
CREATE OR REPLACE VIEW v_sec_holdings_enriched AS
SELECT h.*,
       m.ticker                      AS mapped_ticker,
       COALESCE(f.sector, m.sector)  AS sector,
       m.confidence                  AS map_confidence
FROM sec_holdings h
LEFT JOIN security_map m
       ON m.cusip = h.cusip AND m.deleted_at IS NULL
LEFT JOIN symbol_fundamentals f
       ON f.symbol = m.ticker AND f.deleted_at IS NULL
WHERE h.deleted_at IS NULL;
