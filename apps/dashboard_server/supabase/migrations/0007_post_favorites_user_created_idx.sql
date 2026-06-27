-- =============================================================================
-- Migration: 0007_post_favorites_user_created_idx.sql
-- Purpose   : Index the saved-posts list order. The new GET /favorites/posts
--             endpoint filters by user_id and orders by created_at DESC; the
--             existing idx_post_favorites_user (user_id) does not serve that
--             sort (DB audit Issue #2). Add a composite covering index.
-- Source    : apps/dashboard_server/schema/tradelunch.schema.sql (authoritative,
--             mirrored byte-identical in apps/blog_agent/schema/).
-- Note      : Additive + idempotent. The existing idx_post_favorites_user
--             (user_id) index is KEPT (additive-only convention — not dropped).
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_post_favorites_user_created
    ON post_favorites (user_id, created_at DESC);
