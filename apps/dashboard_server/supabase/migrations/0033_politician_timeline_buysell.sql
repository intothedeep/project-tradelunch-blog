-- =============================================================================
-- 0033_politician_timeline_buysell.sql
-- Purpose   : Expose separate BUY and SELL disclosed-value sums per
--             (filer, ticker, quarter) on v_politician_filer_timeline, so the
--             per-politician quarterly matrix can show how much was bought vs
--             sold — not just the net. Powers the "Quarterly Transaction
--             Activity" table (13F-style pivot, buy/sell colour-coded).
-- Change    : CREATE OR REPLACE VIEW — appends buy_value_usd + sell_value_usd
--             AFTER the existing columns (additive; existing column order,
--             names, and types are unchanged, so replace is safe).
-- Honesty   : These remain DISCLOSED TRANSACTION values (banded downstream),
--             NOT holdings or quarter-end positions. PTR has no position data.
-- Note      : MANUAL — apply by hand AFTER 0032. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

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
    END                                                                                          AS direction,
    -- Appended (0033): gross buy / sell disclosed value, banded downstream.
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'buy'), 0)                     AS buy_value_usd,
    COALESCE(SUM(value_estimate) FILTER (WHERE transaction_type = 'sell'), 0)                    AS sell_value_usd
FROM politician_trades
WHERE ticker IS NOT NULL
  AND transaction_date IS NOT NULL
  AND deleted_at IS NULL
GROUP BY filer_id, ticker, date_trunc('quarter', transaction_date);
