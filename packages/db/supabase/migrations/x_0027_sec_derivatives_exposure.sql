-- =============================================================================
-- Migration: 0027_sec_derivatives_exposure.sql
-- Purpose   : Phase U — revive the 13F options exposure that already lives in
--             sec_holdings.put_call but is discarded by v_sec_positions
--             (which filters put_call = '' to keep only long stock). This view
--             is the COMPLEMENT: one row per (cik, period_of_report, cusip) with
--             the fund's PUT vs CALL notional/shares for that quarter. Zero new
--             collection — pure read over existing rows.
-- Signal    : quarterly derivatives sentiment per fund per security. NOT a
--             gamma/GEX signal (13F is quarter-lagged, positions not chains);
--             that is Phase V. Use as a coarse "who is hedging / betting via
--             options" lens alongside v_sec_positions.
-- Note      : view-only, additive + idempotent (CREATE OR REPLACE VIEW).
--             Re-confirm next free number before applying (multi-session).
--             Mirror into schema/tradelunch.schema.sql (SSOT).
-- =============================================================================

-- Derivatives (option) exposure per (cik, period, cusip), summed across
-- accessions, split into call vs put legs. put_call IN ('PUT','CALL') is exactly
-- the set v_sec_positions excludes.
CREATE OR REPLACE VIEW v_sec_derivatives_exposure AS
SELECT cik, period_of_report, cusip,
       MAX(name_of_issuer)                             AS name_of_issuer,
       SUM(value_usd) FILTER (WHERE put_call = 'CALL') AS call_value_usd,
       SUM(value_usd) FILTER (WHERE put_call = 'PUT')  AS put_value_usd,
       SUM(shares)    FILTER (WHERE put_call = 'CALL') AS call_shares,
       SUM(shares)    FILTER (WHERE put_call = 'PUT')  AS put_shares,
       SUM(value_usd)                                  AS derivatives_value_usd
FROM sec_holdings
WHERE deleted_at IS NULL AND put_call IN ('PUT', 'CALL')
GROUP BY cik, period_of_report, cusip;
