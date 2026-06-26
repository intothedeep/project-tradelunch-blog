-- =============================================================================
-- Migration: 0005_post_status_draft.sql
-- Purpose   : Add the 'draft' value to post_status_enum so authors can save
--             unpublished posts (Phase D2 authoring).
-- Source    : apps/dashboard_server/schema/tradelunch.schema.sql (authoritative)
-- Contract  : packages/types (TPostStatus = public|private|follower|draft)
-- Note      : Additive + idempotent. ADD VALUE IF NOT EXISTS is safe to re-run.
-- =============================================================================

ALTER TYPE post_status_enum ADD VALUE IF NOT EXISTS 'draft';
