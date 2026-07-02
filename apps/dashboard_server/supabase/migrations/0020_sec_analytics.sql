-- =============================================================================
-- Migration: 0020_sec_analytics.sql
-- Purpose   : 13F investment-signal views (Phase P, STEP 1). Turns raw
--             sec_holdings into quarter-over-quarter deltas (P7), NEW/EXIT
--             events (P7), and cross-fund consensus (P8). Read-only views over
--             the backfilled 13F data; no collector writes here except the
--             fund_registry seed.
-- Note      : MANUAL — apply by hand AFTER 0019. Additive + idempotent
--             (CREATE OR REPLACE VIEW). Re-confirm next free number before
--             applying (multi-session).
-- Filter    : matches the rankflow serving filter EXACTLY — put_call = '' AND
--             prn_type <> 'PRN' (long equity only; excludes options + debt).
-- Aggregate : v_sec_positions SUMs across accessions per (cik, period, cusip)
--             because the NEW HOLDINGS reconcile path keeps base + addenda
--             accessions all live for one period (see sec_db_sink.py).
-- Adjacency : deltas compare a fund's ADJACENT filed quarters (v_sec_fund_periods
--             LAG over sec_filings), NOT calendar quarters — a position that
--             exits then re-enters is not falsely diffed against a stale quarter.
-- Active    : fund_registry.is_active_manager flags stock-pickers (Berkshire /
--             Bridgewater / RenTech). Passive index funds replicate the market
--             cap, so their "consensus" is noise — consensus splits active vs
--             total counts. Encoding = a DATA table (not hardcoded SQL) so P10's
--             screener reuses it and fund re-classification is an UPDATE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fund_registry (
    cik               TEXT NOT NULL,             -- zero-padded 10-char, source-native
    label             TEXT NOT NULL,
    is_active_manager BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    CONSTRAINT fund_registry_pkey PRIMARY KEY (cik)
);

INSERT INTO fund_registry (cik, label, is_active_manager) VALUES
    ('0001067983', 'Berkshire Hathaway',       TRUE),
    ('0001350694', 'Bridgewater Associates',   TRUE),
    ('0001037389', 'Renaissance Technologies', TRUE),
    ('0002012383', 'BlackRock',                FALSE),
    ('0000102909', 'Vanguard Group',           FALSE),
    ('0000093751', 'State Street',             FALSE)
ON CONFLICT (cik) DO NOTHING;

-- Base: one row per (cik, period, cusip), summed across accessions, with the
-- fund's in-quarter portfolio weight.
CREATE OR REPLACE VIEW v_sec_positions AS
WITH pos AS (
    SELECT cik, period_of_report, cusip,
           MAX(name_of_issuer) AS name_of_issuer,
           SUM(shares)         AS shares,
           SUM(value_usd)      AS value_usd
    FROM sec_holdings
    WHERE deleted_at IS NULL AND put_call = '' AND prn_type <> 'PRN'
    GROUP BY cik, period_of_report, cusip
)
SELECT p.*,
       ROUND(p.value_usd * 100.0 / NULLIF(
           SUM(p.value_usd) OVER (PARTITION BY cik, period_of_report), 0), 4
       ) AS weight_pct
FROM pos p;

-- Each fund's adjacent filed-quarter ladder (prev_period = the quarter actually
-- filed before this one, NOT calendar-minus-one).
CREATE OR REPLACE VIEW v_sec_fund_periods AS
SELECT cik, period_of_report,
       LAG(period_of_report) OVER (PARTITION BY cik ORDER BY period_of_report) AS prev_period
FROM (
    SELECT DISTINCT cik, period_of_report
    FROM sec_filings WHERE deleted_at IS NULL
) fp;

-- Δ for currently-held positions vs the fund's prior filed quarter.
CREATE OR REPLACE VIEW v_sec_position_delta AS
SELECT cur.cik, cur.period_of_report, cur.cusip, cur.name_of_issuer,
       cur.shares, cur.value_usd, cur.weight_pct,
       fp.prev_period,
       cur.shares     - prev.shares      AS delta_shares,
       cur.weight_pct - prev.weight_pct  AS delta_weight_pct,
       (fp.prev_period IS NOT NULL AND prev.cusip IS NULL) AS is_new,
       (fp.prev_period IS NULL)                            AS is_first_period
FROM v_sec_positions cur
JOIN v_sec_fund_periods fp
  ON fp.cik = cur.cik AND fp.period_of_report = cur.period_of_report
LEFT JOIN v_sec_positions prev
  ON prev.cik = cur.cik AND prev.period_of_report = fp.prev_period
 AND prev.cusip = cur.cusip;

-- EXITs: held in the prior filed quarter, absent now (attributed to this period).
CREATE OR REPLACE VIEW v_sec_exits AS
SELECT fp.cik, fp.period_of_report, prev.cusip, prev.name_of_issuer,
       prev.shares AS prev_shares, prev.weight_pct AS prev_weight_pct
FROM v_sec_fund_periods fp
JOIN v_sec_positions prev
  ON prev.cik = fp.cik AND prev.period_of_report = fp.prev_period
LEFT JOIN v_sec_positions cur
  ON cur.cik = fp.cik AND cur.period_of_report = fp.period_of_report
 AND cur.cusip = prev.cusip
WHERE cur.cusip IS NULL;

-- Cross-fund consensus per (period, cusip): active vs total holder counts.
CREATE OR REPLACE VIEW v_sec_consensus AS
SELECT p.period_of_report, p.cusip,
       MAX(p.name_of_issuer)                                AS name_of_issuer,
       COUNT(*) FILTER (WHERE r.is_active_manager)          AS holder_count_active,
       COUNT(*)                                             AS holder_count_total,
       SUM(p.value_usd) FILTER (WHERE r.is_active_manager)  AS active_value_usd,
       ARRAY_AGG(p.cik ORDER BY p.value_usd DESC)           AS holder_ciks
FROM v_sec_positions p
JOIN fund_registry r ON r.cik = p.cik AND r.deleted_at IS NULL
GROUP BY p.period_of_report, p.cusip;
