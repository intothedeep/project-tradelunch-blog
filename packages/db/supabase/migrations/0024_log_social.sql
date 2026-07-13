-- =============================================================================
-- Migration: 0024_log_social.sql
-- Purpose   : Log social layer (Phase Y-M2) — log_likes + follows tables.
--
-- log_likes: hard-delete on unlike (mirrors post_likes — trivially re-creatable,
--   no audit need). PK = (user_id, log_id) prevents duplicates. FK → log(id)
--   ensures referential integrity. Indexed on log_id for COUNT(*) lookups.
--
-- follows: soft-delete (deleted_at tombstone). A relationship with audit value
--   — re-follow via ON CONFLICT DO UPDATE SET deleted_at = NULL. Self-follow
--   blocked by CHECK (follower_id <> followee_id). Partial indexes on
--   WHERE deleted_at IS NULL keep active-follow lookups fast.
--
-- Source    : packages/db/supabase/migrations/0024_log_social.sql (authoritative).
--             DDL block mirrored in packages/db/schema/tradelunch.schema.sql
--             (after the log_todo block).
-- Contract  : @repo/types (TLogLikeState, TLogFollowState, TLogTimelineResponse).
-- Note      : Additive + idempotent (IF NOT EXISTS). BIGINT ids are STRINGS
--             end-to-end. Soft-delete respected on follows.
-- =============================================================================

CREATE TABLE IF NOT EXISTS log_likes (
    user_id     BIGINT NOT NULL REFERENCES users(id),
    log_id      BIGINT NOT NULL REFERENCES log(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, log_id)
);

CREATE INDEX IF NOT EXISTS idx_log_likes_log ON log_likes(log_id);

CREATE TABLE IF NOT EXISTS follows (
    follower_id  BIGINT NOT NULL REFERENCES users(id),
    followee_id  BIGINT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ NULL,
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id) WHERE deleted_at IS NULL;
