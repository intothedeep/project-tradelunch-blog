-- =============================================================================
-- Migration: 0029_sec_new_positions_mv.sql
-- Purpose   : Phase R.6 — make the 13F "new position" event source cheap.
--             v_sec_position_delta is a full-history self-join view that exceeds
--             the pooler statement_timeout when queried per-event, so the 13F
--             axis of the signal backtest was graceful-skipped. This materializes
--             just the is_new positions (joined to a ticker + the original
--             filing_date) into an indexed table the harness can scan fast.
-- Refresh   : Created WITH NO DATA (instant, no expensive query at apply time).
--             Populate out-of-band with:  REFRESH MATERIALIZED VIEW
--             mv_sec_new_positions;  (collector does this with a raised
--             statement_timeout — see db_sink.refresh_new_positions). Re-refresh
--             after each 13F ingest to pick up new filings.
-- Note      : MANUAL-apply — run by hand after verifying 0028 is applied.
--             Additive + idempotent. Mirror in schema/tradelunch.schema.sql.
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sec_new_positions AS
SELECT
    d.cik,
    d.period_of_report,
    d.cusip,
    sm.ticker,
    f.filing_date
FROM v_sec_position_delta d
JOIN security_map sm
    ON sm.cusip = d.cusip AND sm.deleted_at IS NULL
JOIN (
    -- original filing date per (cik, period); amendments file later, ignore them
    SELECT cik, period_of_report, MIN(filing_date) AS filing_date
    FROM sec_filings
    WHERE filing_date IS NOT NULL AND deleted_at IS NULL
    GROUP BY cik, period_of_report
) f
    ON f.cik = d.cik AND f.period_of_report = d.period_of_report
WHERE d.is_new = true
  AND sm.ticker IS NOT NULL
WITH NO DATA;

-- UNIQUE index enables REFRESH ... CONCURRENTLY and dedupes the event source.
CREATE UNIQUE INDEX IF NOT EXISTS mv_sec_new_positions_pk
    ON mv_sec_new_positions (cik, cusip, period_of_report);

CREATE INDEX IF NOT EXISTS mv_sec_new_positions_filing_idx
    ON mv_sec_new_positions (filing_date);
