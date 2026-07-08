-- =============================================================================
-- 0002_users.sql — finance-local user mirror (Clerk identity → Oracle PG17).
--
-- WHY: finance_api previously read `isAdmin` straight from Clerk publicMetadata
--   to stay DB-decoupled (0001 deliberately EXCLUDED the blog `users` table).
--   That is now reversed: finance stores its own users so (a) role lives in OUR
--   DB (SELECT is_admin, not Clerk metadata) and (b) per-user domain data can
--   FK to users.id. Clerk remains the auth/identity provider (signin/signup);
--   this table is a local MIRROR keyed by clerk_user_id, populated lazily on
--   first authenticated request (see finance_api helpers/provisionUser.ts).
--
-- NOTE: this is a SEPARATE users table from the blog's Supabase users — the two
--   never share rows. Same person = two independent mirror rows (one per DB).
--
-- BOOTSTRAP FIRST ADMIN (no in-app UI, same as blog):
--   UPDATE users SET is_admin = true WHERE clerk_user_id = '<clerk id>';
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clerk_user_id TEXT UNIQUE NOT NULL,          -- Clerk identity (join key)
    username      VARCHAR(50),
    display_name  VARCHAR(100),
    avatar_url    TEXT,
    email         VARCHAR(255),
    is_admin      BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMPTZ DEFAULT NULL       -- soft-delete tombstone
);

-- Hot-path lookup: provisionUser SELECTs by clerk_user_id on every request.
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id
    ON users (clerk_user_id) WHERE deleted_at IS NULL;
