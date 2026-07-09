-- =============================================================================
-- Migration: 0023_politician_holders.sql
-- Purpose   : Additive enrichment for per-politician holder breakdown and
--             quarterly timeline. Adds source-aggregate columns to
--             politician_registry (as reported by kadoa filers.json) and
--             two aggregate views:
--               v_politician_ticker_holders  — per-filer trade summary by ticker
--               v_politician_filer_timeline  — quarterly net-flow timeline per
--                                              (filer, ticker) pair
-- Note      : MANUAL — apply by hand AFTER 0022. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

-- Enrich politician_registry with source aggregates from kadoa filers.json.
-- All columns are additive and NULL-safe — existing rows are unchanged.
ALTER TABLE politician_registry
    ADD COLUMN IF NOT EXISTS photo_url    TEXT   NULL,
    ADD COLUMN IF NOT EXISTS trade_count  INT    NULL,
    ADD COLUMN IF NOT EXISTS purchases    INT    NULL,
    ADD COLUMN IF NOT EXISTS sales        INT    NULL,
    ADD COLUMN IF NOT EXISTS late_filings INT    NULL,
    ADD COLUMN IF NOT EXISTS est_volume   BIGINT NULL;

-- Per-(ticker, filer_id) trade summary — surfaces which politicians traded
-- each ticker and in which direction (buy_skew / sell_skew / mixed).
-- net_direction idiom mirrors v_politician_activity exactly.
CREATE OR REPLACE VIEW v_politician_ticker_holders AS
SELECT
    ticker,
    filer_id,
    SUM(value_estimate)                                                  AS disclosed_value_usd,
    COUNT(*)                                                             AS trade_count,
    COUNT(*) FILTER (WHERE transaction_type = 'buy')                     AS buy_count,
    COUNT(*) FILTER (WHERE transaction_type = 'sell')                    AS sell_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'buy')
           > COUNT(*) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy_skew'
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'sell')
           > COUNT(*) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell_skew'
        ELSE 'mixed'
    END                                                                  AS net_direction,
    MAX(disclosure_date)                                                 AS latest_disclosure,
    MIN(disclosure_date)                                                 AS first_disclosure
FROM politician_trades
WHERE ticker IS NOT NULL
  AND deleted_at IS NULL
GROUP BY ticker, filer_id;

-- Quarterly net disclosed-flow per (filer, ticker) — drives a timeline chart
-- on the per-politician detail page.
-- net_value_usd = buy flow − sell flow (COALESCE guards NULL when one side is
-- absent for that quarter).
-- direction uses the same buy_count vs sell_count CASE idiom as
-- v_politician_activity rather than referencing the computed alias, which
-- would require a subquery.
CREATE OR REPLACE VIEW v_politician_filer_timeline AS
SELECT
    filer_id,
    ticker,
    date_trunc('quarter', transaction_date)::date                                                AS quarter,
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'buy'), 0)
        - COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'sell'), 0)             AS net_value_usd,
    COUNT(*) FILTER (WHERE transaction_type = 'buy')                                             AS buy_count,
    COUNT(*) FILTER (WHERE transaction_type = 'sell')                                            AS sell_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'buy')
           > COUNT(*) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy'
        WHEN COUNT(*) FILTER (WHERE transaction_type = 'sell')
           > COUNT(*) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell'
        ELSE 'mixed'
    END                                                                                          AS direction
FROM politician_trades
WHERE ticker IS NOT NULL
  AND transaction_date IS NOT NULL
  AND deleted_at IS NULL
GROUP BY filer_id, ticker, date_trunc('quarter', transaction_date);
