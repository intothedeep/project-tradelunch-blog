-- =============================================================================
-- Migration: 0031_sec_new_positions_mapped.sql
-- Purpose   : Phase R.6 fix — make mv_sec_new_positions cheap to (re)populate.
--             0029's definition went through v_sec_position_delta, which computes
--             v_sec_positions (a full GROUP BY over ALL sec_holdings) TWICE and
--             self-joins — REFRESH blew past a 600s timeout on the pooler.
--             The backtest only needs positions whose CUSIP maps to a ticker
--             (security_map, ~250 rows), so we push that filter DOWN into the
--             position CTE: the self-join then runs on the mapped subset only.
--             Measured: ~4.6s for the full history (vs >600s before).
-- Note      : MANUAL-apply — supersedes the 0029 materialized view (same name).
--             Populated WITH DATA (fast). Re-REFRESH after each 13F ingest
--             (db_sink.refresh_new_positions). Mirror in tradelunch.schema.sql.
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_sec_new_positions;

CREATE MATERIALIZED VIEW mv_sec_new_positions AS
WITH mapped AS (
    SELECT DISTINCT cusip, ticker
    FROM security_map
    WHERE deleted_at IS NULL AND ticker IS NOT NULL
),
pos AS (   -- fund positions, restricted to mapped CUSIPs (the expensive shrink)
    SELECT h.cik, h.period_of_report, h.cusip
    FROM sec_holdings h
    JOIN mapped m ON m.cusip = h.cusip
    WHERE h.deleted_at IS NULL AND h.put_call = '' AND h.prn_type <> 'PRN'
    GROUP BY h.cik, h.period_of_report, h.cusip
),
periods AS (   -- each fund's adjacent filed-quarter ladder
    SELECT cik, period_of_report,
           LAG(period_of_report) OVER (PARTITION BY cik ORDER BY period_of_report) AS prev_period
    FROM (SELECT DISTINCT cik, period_of_report FROM sec_filings WHERE deleted_at IS NULL) fp
),
newpos AS (   -- held this quarter, absent in the fund's prior filed quarter
    SELECT cur.cik, cur.period_of_report, cur.cusip
    FROM pos cur
    JOIN periods p ON p.cik = cur.cik AND p.period_of_report = cur.period_of_report
    LEFT JOIN pos prev ON prev.cik = cur.cik
        AND prev.period_of_report = p.prev_period
        AND prev.cusip = cur.cusip
    WHERE p.prev_period IS NOT NULL AND prev.cusip IS NULL
)
SELECT n.cik, n.period_of_report, n.cusip, m.ticker, f.filing_date
FROM newpos n
JOIN mapped m ON m.cusip = n.cusip
JOIN (
    SELECT cik, period_of_report, MIN(filing_date) AS filing_date
    FROM sec_filings
    WHERE filing_date IS NOT NULL AND deleted_at IS NULL
    GROUP BY cik, period_of_report
) f ON f.cik = n.cik AND f.period_of_report = n.period_of_report
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_sec_new_positions_pk
    ON mv_sec_new_positions (cik, cusip, period_of_report);
CREATE INDEX IF NOT EXISTS mv_sec_new_positions_filing_idx
    ON mv_sec_new_positions (filing_date);
