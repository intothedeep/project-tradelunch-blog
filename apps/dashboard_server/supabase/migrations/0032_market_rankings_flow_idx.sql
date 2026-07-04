-- 0032_market_rankings_flow_idx.sql
-- Accelerates GET /rankings/flow which uses DISTINCT ON (date_trunc(granularity, as_of))
-- + WHERE scope='global' AND rank<=k. The composite index covers the partition key
-- (scope), optional sector filter, the ORDER BY (as_of DESC), and projection cols.
-- Safe to apply to a live table — no write-lock required (IF NOT EXISTS guard).
CREATE INDEX IF NOT EXISTS idx_market_rankings_scope_asof
    ON market_rankings (scope, sector, as_of DESC, symbol, rank);
