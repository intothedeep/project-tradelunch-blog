-- =============================================================================
-- Migration: 0013_symbol_fundamentals.sql
-- Purpose   : Phase I (I2.8) — per-symbol FUNDAMENTALS cache so the weekly rank
--             derives market_cap = shares_outstanding x local close WITHOUT a
--             per-symbol yfinance `.info` call (the ban-prone endpoint). Covers
--             the FULL ~500 candidate pool (not just tracked winners), so it
--             cannot live in tracked_symbols.
-- Refresh   : shares_outstanding via fast_info MONTHLY (shares_refreshed_at);
--             sector via `.info` QUARTERLY (sector_refreshed_at). market_cap is
--             NOT stored — derived fresh each week (it moves with every close).
-- Contract  : weekly upsert ON CONFLICT(symbol) DO UPDATE, COALESCE-merge so a
--             clock only advances when that field was actually refreshed; revives
--             soft-deleted rows (deleted_at = NULL). Reads are table-guarded
--             (to_regclass) so the weekly job still runs on an un-migrated DB.
-- Note      : MANUAL — apply by hand AFTER 0012. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

CREATE TABLE IF NOT EXISTS symbol_fundamentals (
    symbol              TEXT NOT NULL,
    shares_outstanding  NUMERIC NULL,
    sector              TEXT NULL,
    shares_refreshed_at TIMESTAMPTZ NULL,
    sector_refreshed_at TIMESTAMPTZ NULL,
    source              TEXT NOT NULL DEFAULT 'yahoo',
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMPTZ NULL,
    CONSTRAINT symbol_fundamentals_pkey PRIMARY KEY (symbol)
);
