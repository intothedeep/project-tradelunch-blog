-- =============================================================================
-- 0018_symbol_fundamentals_long_name.sql
-- Purpose   : Add a company display name to the fundamentals cache so /rankings
--             (and any symbol view) can render a human-readable name under the
--             ticker. Sourced from Yahoo `.info` longName/shortName, refreshed on
--             the SAME quarterly clock as `sector` (both ride one `.info` call).
-- Note      : MANUAL — apply by hand AFTER 0013. Additive + idempotent.
--             Re-confirm next free number before applying (multi-session).
-- Backfill  : long_name is NULL until the weekly collector runs. plan_refresh
--             forces an `.info` refetch for every symbol whose long_name IS NULL,
--             so a single `collector-weekly` dispatch populates the whole universe.
--             Both the collector (db_sink) and the Express rankings endpoint probe
--             this column's presence, so applying this migration is safe in any
--             order relative to a deploy (feature stays dormant until applied).
-- =============================================================================

ALTER TABLE symbol_fundamentals
    ADD COLUMN IF NOT EXISTS long_name TEXT NULL;
