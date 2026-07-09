-- =============================================================================
-- Migration: 0006_post_favorites.sql
-- Purpose   : Persist per-user blog post favorites (Phase 2 — post-card Save).
-- Source    : apps/dashboard_server/schema/tradelunch.schema.sql (authoritative,
--             mirrored byte-identical in apps/blog_agent/schema/).
-- Contract  : packages/types (TFavoritesResponse / TFavoriteToggleResponse).
-- Note      : Additive + idempotent. Composite PK (user_id, post_id) makes the
--             insert naturally dedupe via ON CONFLICT DO NOTHING. post_id is a
--             Snowflake BIGINT — handled as a STRING end-to-end on read.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_favorites (
    user_id     BIGINT NOT NULL REFERENCES users(id),
    post_id     BIGINT NOT NULL REFERENCES posts(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_favorites_user ON post_favorites(user_id);
