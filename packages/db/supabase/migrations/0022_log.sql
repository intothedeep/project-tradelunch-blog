-- =============================================================================
-- Migration: 0022_log.sql
-- Purpose   : Threads-style personal micro-feed (Phase Y — M1: posts + recursive
--             replies). A dedicated self-referencing `log` table — NOT a reuse of
--             `posts` or `comments` — so that Log nodes are structurally isolated
--             from the blog surface (no slug/title NOT-NULL fakes, no WHERE kind
--             guards on every feed query, no sitemap bleed).
--             Materialized-path pattern reused from 0009_comments.sql:
--               path = parent.path || id  (self-inclusive; root's path = ARRAY[id])
--             Depth is derived as cardinality(path)-1 (0 = top-level), never stored.
--             Ancestors query = WHERE id = ANY(focus.path[1:cardinality(focus.path)-1])
--             — a plain PK scan, no WITH RECURSIVE.
-- Source    : packages/db/supabase/migrations/0022_log.sql (authoritative).
--             Byte-identical DDL block mirrored in:
--               apps/dashboard_server/schema/tradelunch.schema.sql
--               apps/blog_agent/schema/tradelunch.schema.sql
-- Contract  : @repo/types (TLog, TLogStreamResponse, TLogThreadResponse,
--             TLogCreateRequest).
-- Auth rules: top-level (parentId=null) = owner-only · replies = any logged-in
--             user (unlimited depth) · delete = author/log-owner/admin · reply
--             to soft-deleted parent = 400.
-- Note      : Additive + idempotent (IF NOT EXISTS on table and each index).
--             Soft-delete via deleted_at tombstone (masked at READ).
--             BIGINT ids read as STRINGS end-to-end; never Number()/parseInt them.
--             FK ON DELETE: NO ACTION (matches comments/post_favorites/post_likes
--             convention — db-structure-audit Issue #3; app soft-deletes, never
--             hard-DELETE).
-- =============================================================================

CREATE TABLE IF NOT EXISTS log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    parent_id   BIGINT NULL     REFERENCES log(id),  -- self-ref; NULL = top-level log post
    -- Self-inclusive materialized path: parent.path || id.
    -- Root's path = ARRAY[id]. Depth = cardinality(path) - 1.
    path        BIGINT[] NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ NULL                     -- soft-delete tombstone (masked at READ)
);

-- Top-level log stream per user, newest-first (stream/feed query).
CREATE INDEX IF NOT EXISTS idx_log_user_toplevel ON log(user_id, id DESC) WHERE parent_id IS NULL;

-- Direct-child (depth-1) lookup for focus-node view replies.
CREATE INDEX IF NOT EXISTS idx_log_parent ON log(parent_id, id);

-- Ancestor chain lookup: WHERE id = ANY(focus.path[1:N-1]) hits PK; this GIN
-- index accelerates the inverse — "which focus nodes contain a given ancestor id
-- in their path" — used for subtree invalidation and future M2 fan-out.
CREATE INDEX IF NOT EXISTS idx_log_path ON log USING GIN(path);
