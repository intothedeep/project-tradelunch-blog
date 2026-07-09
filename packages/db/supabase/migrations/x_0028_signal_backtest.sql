-- =============================================================================
-- Migration: 0028_signal_backtest.sql
-- Purpose   : Phase R — event-study / forward-return signal-validation harness.
--             Observation-level table: one row per (signal_type, ticker, as_of,
--             horizon_days) storing the cumulative abnormal return (CAR) and a
--             directional hit boolean. Aggregation (mean CAR, hit-rate, t-stat)
--             is computed at query time via v_signal_backtest_summary to keep
--             the raw data auditable.
-- Signals   : 'politician_buy' | 'politician_sell' | '13f_new_position'
-- Note      : MANUAL-apply — run by hand after verifying 0027 is applied.
--             Additive + idempotent (CREATE TABLE IF NOT EXISTS;
--             CREATE OR REPLACE VIEW). Re-confirm next free number before
--             applying (multi-session). Mirror in schema/tradelunch.schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS signal_backtest (
    signal_type  TEXT        NOT NULL,          -- 'politician_buy' | 'politician_sell' | '13f_new_position'
    ticker       TEXT        NOT NULL,
    as_of        DATE        NOT NULL,           -- event date (disclosure_date / filing_date)
    horizon_days INT         NOT NULL,           -- 1 | 5 | 21
    car          NUMERIC         NULL,           -- cumulative (abnormal) return over the horizon
    is_hit       BOOLEAN         NULL,           -- car>0 for buy-like; car<0 for sell-like
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ         NULL,
    CONSTRAINT signal_backtest_pkey PRIMARY KEY (signal_type, ticker, as_of, horizon_days)
);

-- Roll-up summary per (signal_type, horizon_days): mean CAR, hit-rate, n, t-stat.
-- t_stat = mean_car / (std_err) where std_err = STDDEV_SAMP / SQRT(n).
-- Returns NULL t_stat when stddev is 0 or n=1 (NULLIF guard).
CREATE OR REPLACE VIEW v_signal_backtest_summary AS
SELECT
    signal_type,
    horizon_days,
    AVG(car)                                                               AS mean_car,
    AVG(is_hit::int)                                                       AS hit_rate,
    COUNT(*)                                                               AS n,
    AVG(car) / NULLIF(STDDEV_SAMP(car) / SQRT(COUNT(*)), 0)               AS t_stat
FROM signal_backtest
WHERE deleted_at IS NULL
  AND car IS NOT NULL
GROUP BY signal_type, horizon_days
ORDER BY signal_type, horizon_days;
