-- =============================================================================
-- Migration: 0024_politician_person_key.sql
-- Purpose   : Re-key v_politician_activity traded_by/buy_member/sell_member
--             counts from filer_id to a bioguide-first person identity
--             (COALESCE(r.bioguide_id, pt.filer_id)). One politician can hold
--             multiple kadoa filer_id slugs across chamber changes (House →
--             Senate) or name-spelling variants; counting distinct filer_ids
--             over-counts unique members. politician_registry.bioguide_id is now
--             97.2% populated via enrich_bioguide — re-keying collapses those
--             variants to a single person. Filer-level views
--             (v_politician_ticker_holders / v_politician_filer_timeline) remain
--             filer_id-keyed intentionally — they power the per-filer profile
--             page which must show each filing record separately; out of scope.
-- Note      : MANUAL — apply by hand AFTER 0023. Additive + idempotent
--             (CREATE OR REPLACE VIEW). Re-confirm next free number before
--             applying (multi-session).
-- =============================================================================

-- Re-key aggregate member counts to person identity (bioguide_id-first).
-- A CTE resolves person_key once per row before aggregation, keeping the
-- FILTER clauses terse and consistent.
CREATE OR REPLACE VIEW v_politician_activity AS
WITH trades AS (
    SELECT
        pt.ticker,
        pt.transaction_type,
        pt.disclosure_date,
        COALESCE(r.bioguide_id, pt.filer_id) AS person_key
    FROM politician_trades pt
    LEFT JOIN politician_registry r
           ON r.filer_id = pt.filer_id AND r.deleted_at IS NULL
    WHERE pt.ticker IS NOT NULL
      AND pt.deleted_at IS NULL
      AND pt.disclosure_date >= CURRENT_DATE - INTERVAL '90 days'
)
SELECT
    ticker,
    COUNT(DISTINCT person_key)                                                    AS traded_by_count,
    COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')            AS buy_member_count,
    COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')           AS sell_member_count,
    CASE
        WHEN COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')
           > COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')
            THEN 'buy_skew'
        WHEN COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell')
           > COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')
            THEN 'sell_skew'
        ELSE 'mixed'
    END                                                                           AS net_direction,
    MAX(disclosure_date)                                                          AS latest_disclosure_date,
    (
        COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'buy')  >= 3
        OR
        COUNT(DISTINCT person_key) FILTER (WHERE transaction_type = 'sell') >= 3
    )                                                                             AS cluster_flag
FROM trades
GROUP BY ticker;
