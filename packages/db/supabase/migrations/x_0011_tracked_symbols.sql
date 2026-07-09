-- =============================================================================
-- Migration: 0011_tracked_symbols.sql
-- Purpose   : Phase I (Phase 2) — STICKY universe. A symbol that enters market-cap
--             ranking even once is tracked forever and collected daily thereafter.
--             NO auto-removal, NO hysteresis: soft-delete (deleted_at) only, by
--             manual admin action. The weekly re-rank UPSERTs (ON CONFLICT(symbol)
--             DO UPDATE) and revives any soft-deleted row (deleted_at = NULL).
-- Contract  : `label` is UNIQUE — it protects the GLOBAL history-label namespace
--             (market_history is keyed by label only). run_daily UNIONs the active
--             rows (deleted_at IS NULL) into the collection universe.
-- Note      : MANUAL — apply to Supabase by hand (NOT auto-run by any code path).
--             Additive + idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
--             Apply order: re-confirm next free number with
--             `ls apps/dashboard_server/supabase/migrations/` (0010 = Phase G).
-- =============================================================================

CREATE TABLE IF NOT EXISTS tracked_symbols (
    symbol          TEXT NOT NULL,
    category        TEXT NOT NULL,
    label           TEXT NOT NULL,
    sector          TEXT NULL,
    source          TEXT NOT NULL DEFAULT 'yahoo',
    exchange        TEXT NULL,
    first_ranked_at TIMESTAMPTZ NULL,
    last_ranked_at  TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ NULL,
    CONSTRAINT tracked_symbols_pkey PRIMARY KEY (symbol),
    CONSTRAINT tracked_symbols_label_key UNIQUE (label),
    CONSTRAINT tracked_symbols_category_check
        CHECK (category IN ('fx', 'crypto', 'indices', 'rates', 'stocks'))
);

-- Active-universe lookups (run_daily) filter deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_tracked_symbols_category
    ON tracked_symbols(category) WHERE deleted_at IS NULL;
