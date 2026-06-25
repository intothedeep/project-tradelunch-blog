-- =============================================================================
-- Migration: 0001_blog_schema.sql
-- Purpose   : Create blog schema tables derived from dashboard_server SQL queries.
-- Source    : apps/dashboard_server/src/controllers/posts/posts.ts (all 5 queries)
--             apps/dashboard_server/scripts/publish_post/insert_*.ts (write side)
--             apps/dashboard_server/scripts/fix_*.ts (constraint migrations)
--
-- ⚠️ DRAFT — derived from query evidence, NOT from the live DB.
--    Columns marked [INFERRED] MUST be reconciled against the authoritative
--    AWS RDS `pg_dump --schema-only` before treating this as final (M2 step C1).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           BIGINT PRIMARY KEY,                          -- Snowflake ID; set by application
    username     VARCHAR(100) NOT NULL UNIQUE,                -- [INFERRED length]
    deleted_at   TIMESTAMP    DEFAULT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- categories (self-referencing tree; parent_id NULL = root node)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id           BIGINT       PRIMARY KEY,                    -- Snowflake ID; set by application
    user_id      BIGINT       NOT NULL REFERENCES users(id),
    parent_id    BIGINT       DEFAULT NULL,                   -- NULL = root; self-FK declared below
    group_id     BIGINT       DEFAULT NULL,                   -- ID of root ancestor in this tree
    title        VARCHAR(100) NOT NULL,
    level        INT          NOT NULL DEFAULT 0,             -- 0 = root, 1 = first child, ...
    priority     INT          DEFAULT NULL,                   -- [INFERRED] ordering weight
    seq          INT          DEFAULT NULL,                   -- [INFERRED] sibling sort key (LPAD 6)
    deleted_at   TIMESTAMP    DEFAULT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Self-referencing FK; DEFERRABLE so tree inserts work in any order within a txn
ALTER TABLE categories
    ADD CONSTRAINT categories_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES categories(id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_title_unique
    ON categories (user_id, title);

CREATE INDEX IF NOT EXISTS categories_user_id_deleted_at_idx
    ON categories (user_id, deleted_at);

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id           BIGINT        PRIMARY KEY,                   -- Snowflake ID; set by application
    user_id      BIGINT        NOT NULL REFERENCES users(id),
    slug         VARCHAR(255)  NOT NULL,
    title        TEXT          NOT NULL,                      -- [INFERRED type; could be VARCHAR(500)]
    content      TEXT          DEFAULT NULL,
    description  TEXT          DEFAULT NULL,                  -- [INFERRED nullable; not in INSERT]
    status       VARCHAR(20)   NOT NULL DEFAULT 'public',     -- 'public' | 'draft' observed
    category_id  BIGINT        DEFAULT NULL REFERENCES categories(id),
    group_id     BIGINT        DEFAULT NULL,                  -- set to same value as id on INSERT
    seq          INT           DEFAULT NULL,                  -- [INFERRED] sibling sort key
    priority     INT           DEFAULT NULL,                  -- [INFERRED] ordering weight
    deleted_at   TIMESTAMP     DEFAULT NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS posts_user_id_slug_unique
    ON posts (user_id, slug);

CREATE INDEX IF NOT EXISTS posts_id_desc_idx
    ON posts (id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_user_id_status_idx
    ON posts (user_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS posts_category_id_idx
    ON posts (category_id)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- files (post images; stored_uri = S3 key today, Supabase Storage path Phase B)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id                BIGINT        PRIMARY KEY,              -- Snowflake ID; set by application
    user_id           BIGINT        NOT NULL REFERENCES users(id),
    post_id           BIGINT        NOT NULL REFERENCES posts(id),
    content_type      VARCHAR(100)  DEFAULT NULL,             -- MIME type; e.g. 'image/png'
    ext               VARCHAR(10)   DEFAULT NULL,             -- e.g. 'png'
    original_filename VARCHAR(255)  DEFAULT NULL,
    stored_name       VARCHAR(255)  NOT NULL,
    stored_uri        TEXT          DEFAULT NULL,             -- S3 key -> Supabase Storage path in Phase B
    file_size         BIGINT        DEFAULT NULL,             -- [INFERRED type; could be INT]
    is_thumbnail      BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP     DEFAULT NULL,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS files_user_id_stored_name_unique
    ON files (user_id, stored_name);

CREATE INDEX IF NOT EXISTS files_post_id_thumbnail_idx
    ON files (post_id, is_thumbnail)
    WHERE is_thumbnail = TRUE;

-- ---------------------------------------------------------------------------
-- post_tags (denormalized: tag name stored directly; no separate tags table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_tags (
    id         BIGINT        PRIMARY KEY,                     -- [INFERRED; could be composite (post_id, tag_title)]
    post_id    BIGINT        NOT NULL REFERENCES posts(id),
    tag_title  TEXT          DEFAULT NULL,                    -- [INFERRED type; nullable per FILTER clause]
    deleted_at TIMESTAMP     DEFAULT NULL,
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS post_tags_post_id_deleted_at_idx
    ON post_tags (post_id, deleted_at);
