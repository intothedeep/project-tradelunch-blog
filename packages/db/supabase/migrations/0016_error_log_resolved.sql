-- =============================================================================
-- Migration: 0016_error_log_resolved.sql
-- Purpose   : Add a `resolved` tracker to error_log (0014) so failed events can
--             be triaged: 0 = open/unresolved (default), 1 = resolved. Mirrors
--             the same column on batch_log (0015).
-- Note      : MANUAL — apply by hand AFTER 0015. Additive + idempotent.
--             The 0014 insert path does NOT reference `resolved` (DEFAULT 0
--             applies), so this column is decoupled from app code — applying it
--             later, or not at all, never breaks the existing error ingest.
-- =============================================================================

ALTER TABLE error_log
    ADD COLUMN IF NOT EXISTS resolved SMALLINT NOT NULL DEFAULT 0;

-- Open-error lookup: WHERE resolved = 0 ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_error_log_resolved_created
    ON error_log(resolved, created_at);
