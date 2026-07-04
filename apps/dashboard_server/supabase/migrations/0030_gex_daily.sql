-- Migration: 0030_gex_daily
-- Phase V-collect: dealer Gamma Exposure (GEX) daily scalar table.
--
-- MANUAL-APPLY REQUIRED: run against Supabase SQL editor or psql with
-- POSTGRES_URL_NON_POOLING (direct/session connection, port 5432).
--
-- Re-confirm next free migration number before applying: as of 2026-07-03
-- the highest applied is 0028; another task owns 0029.  If a concurrent
-- migration has landed between 0028 and this file, rename accordingly.
--
-- Idempotent: IF NOT EXISTS / DO NOTHING guards make re-application safe.
--
-- SSOT-MIRROR-TODO: mirror this DDL into
--   apps/blog_agent/schema/tradelunch.schema.sql and
--   apps/dashboard_server/schema/tradelunch.schema.sql
-- (do not edit during this PR; left for the schema-sync sweep).

CREATE TABLE IF NOT EXISTS gex_daily (
    -- PK: one GEX scalar per underlying per calendar date
    as_of       DATE    NOT NULL,
    ticker      TEXT    NOT NULL,

    -- GEX components (USD per 1% spot move)
    -- Sign convention: net_gex = call_gex - put_gex
    --   net_gex > 0 → dealers net long gamma (dampening)
    --   net_gex < 0 → dealers net short gamma (amplifying)
    net_gex     NUMERIC NOT NULL,
    call_gex    NUMERIC NOT NULL,   -- unsigned call-side total
    put_gex     NUMERIC NOT NULL,   -- unsigned put-side total

    spot        NUMERIC NOT NULL,   -- underlying close used in γ calculation
    source      TEXT    NOT NULL,   -- provider key, e.g. 'yfinance'

    -- Audit columns (standard pattern)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ,        -- soft-delete only; NULL = active

    PRIMARY KEY (as_of, ticker)
);

-- Partial index: active rows only (deleted_at IS NULL) for dashboard queries.
CREATE INDEX IF NOT EXISTS idx_gex_daily_active_ticker
    ON gex_daily (ticker, as_of DESC)
    WHERE deleted_at IS NULL;
