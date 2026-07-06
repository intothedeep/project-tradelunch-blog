-- =============================================================================
-- Migration: 0035_sec_consensus_asof.sql
-- Purpose   : filing_date look-ahead gate for the Phase P screener's 13F consensus
--             (Option A). Replaces the single-period MAX(period_of_report) filter
--             with a per-fund "most-recent filing whose filing_date <= CURRENT_DATE"
--             approach. Fixes TWO problems simultaneously:
--             (a) look-ahead: future-dated filings (filing_date > today) are
--                 excluded from the screener until the filing goes public.
--             (b) staggered-filing undercount: during the 45-day window after
--                 quarter-end, funds file sequentially. The old MAX(period) filter
--                 drops all funds that haven't yet filed for the latest period,
--                 undercounting consensus. Per-fund latest-as-of keeps each fund's
--                 most-recent public filing regardless of period.
-- Note      : MANUAL — apply by hand AFTER 0034. Additive + idempotent
--             (CREATE OR REPLACE VIEW). Do NOT edit 0020 (the base consensus view).
-- Live-only : CURRENT_DATE is hardcoded in views (views cannot take parameters).
--             This is correct for the screener which always runs as of today.
-- View chain : v_sec_fund_period_public → v_sec_fund_latest_asof → v_sec_consensus_asof
-- =============================================================================

-- Step 1: one row per (cik, period), keeping only periods with a known filing_date.
-- MIN(filing_date) follows the 0029/0031 pattern: original filing date wins over
-- amendments (which file later under the same period).
CREATE OR REPLACE VIEW v_sec_fund_period_public AS
SELECT cik,
       period_of_report,
       MIN(filing_date) AS first_filed
FROM sec_filings
WHERE filing_date IS NOT NULL
  AND deleted_at IS NULL
GROUP BY cik, period_of_report;

-- Step 2: each fund's most-recent period whose first filing is already public.
-- DISTINCT ON (cik) + ORDER BY period_of_report DESC picks the newest eligible period.
-- Funds whose ONLY periods have future filing_dates are entirely excluded.
CREATE OR REPLACE VIEW v_sec_fund_latest_asof AS
SELECT DISTINCT ON (cik)
    cik,
    period_of_report AS as_of_period,
    first_filed
FROM v_sec_fund_period_public
WHERE first_filed <= CURRENT_DATE
ORDER BY cik, period_of_report DESC;

-- Step 3: cross-fund consensus with mixed periods (correct — each fund contributes
-- its own most-recent public quarter). Schema mirrors v_sec_consensus exactly except:
--   period_of_report → max_period (MAX over the joined positions, since periods differ).
-- Columns: cusip, max_period, name_of_issuer, holder_count_active, holder_count_total,
--          active_value_usd, holder_ciks.
CREATE OR REPLACE VIEW v_sec_consensus_asof AS
SELECT p.cusip,
       MAX(p.period_of_report)                              AS max_period,
       MAX(p.name_of_issuer)                                AS name_of_issuer,
       COUNT(*) FILTER (WHERE r.is_active_manager)          AS holder_count_active,
       COUNT(*)                                             AS holder_count_total,
       SUM(p.value_usd) FILTER (WHERE r.is_active_manager)  AS active_value_usd,
       ARRAY_AGG(p.cik ORDER BY p.value_usd DESC)           AS holder_ciks
FROM v_sec_fund_latest_asof la
JOIN v_sec_positions p
  ON p.cik = la.cik AND p.period_of_report = la.as_of_period
JOIN fund_registry r
  ON r.cik = p.cik AND r.deleted_at IS NULL
GROUP BY p.cusip;
