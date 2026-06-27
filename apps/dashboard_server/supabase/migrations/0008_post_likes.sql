-- =============================================================================
-- Migration: 0008_post_likes.sql
-- Purpose   : Persist per-user blog post LIKES (Phase E — public like count).
--             A like is a PUBLIC approval signal (aggregate COUNT visible to
--             everyone + a per-viewer "did I like this" boolean), distinct from
--             the PRIVATE post_favorites bookmark.
-- Source    : apps/dashboard_server/schema/tradelunch.schema.sql (authoritative,
--             mirrored byte-identical in apps/blog_agent/schema/).
-- Contract  : @repo/types (TLikeToggleResponse).
-- Note      : Additive + idempotent. Composite PK (user_id, post_id) makes the
--             insert naturally dedupe via ON CONFLICT DO NOTHING (one like per
--             user per post). post_id is a Snowflake BIGINT — handled as a
--             STRING end-to-end on read. Like count is a LIVE COUNT(*) (no
--             denormalized counter), served by idx_post_likes_post.
--             FK ON DELETE: NO ACTION (no ON DELETE clause), matching
--             post_favorites for cross-table consistency (db-structure-audit
--             Issue #3). The app soft-deletes posts (deleted_at), never hard
--             DELETE, so like rows are never orphaned in practice.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_likes (
    user_id     BIGINT NOT NULL REFERENCES users(id),
    post_id     BIGINT NOT NULL REFERENCES posts(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- Per-post COUNT(*) hot path (the public like count).
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
