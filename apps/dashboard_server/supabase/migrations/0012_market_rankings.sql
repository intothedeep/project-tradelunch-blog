-- =============================================================================
-- Migration: 0012_market_rankings.sql
-- Purpose   : Phase I (Phase 2) — append-only WEEKLY market-cap ranking series.
--             One row per (as_of, symbol, scope). ALL tracked symbols are recorded
--             each week (not just top-N) so the time series is complete. Sector
--             ranking depth = top-10; plus a global top-20 (scope distinguishes).
-- Contract  : idempotent re-run of the same week via ON CONFLICT(as_of,symbol,scope)
--             DO UPDATE. market_cap nullable (carry-forward / partial-fetch allowed).
-- Note      : MANUAL — apply by hand AFTER 0011. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_rankings (
    as_of       DATE NOT NULL,
    symbol      TEXT NOT NULL,
    scope       TEXT NOT NULL,
    sector      TEXT NULL,
    rank        INT NOT NULL,
    market_cap  NUMERIC NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT market_rankings_pkey PRIMARY KEY (as_of, symbol, scope),
    CONSTRAINT market_rankings_scope_check CHECK (scope IN ('global', 'sector'))
);

CREATE INDEX IF NOT EXISTS idx_market_rankings_asof_scope
    ON market_rankings(as_of, scope, rank);
