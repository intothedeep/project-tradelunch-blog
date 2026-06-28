-- =============================================================================
-- Migration: 0010_category_unique_parent.sql
-- Purpose   : Allow same-titled categories under DIFFERENT parents (Phase G —
--             editor category selector). Replaces the per-user UNIQUE(user_id,
--             title) with UNIQUE(user_id, parent_id, title) so e.g.
--             "투자 ▸ 반도체" and "산업 ▸ 반도체" can coexist, while a duplicate
--             under the SAME parent (including two roots of the same title, via
--             NULLS NOT DISTINCT) is still rejected.
-- Contract  : helpers/writeCategory.ts conflict check is (user_id, parent_id,
--             title). blog_agent category.py ON CONFLICT updated in lockstep.
-- Note      : MANUAL — apply to Supabase by hand (NOT auto-run by any code path).
--             Additive + idempotent (guarded by pg_constraint lookups).
--             Requires PG15+ for `NULLS NOT DISTINCT` (Supabase qualifies).
-- Pre-check : ensure no existing (user_id, parent_id, title) duplicates remain
--             before applying, or the ADD CONSTRAINT will fail.
-- =============================================================================

DO $$
BEGIN
    -- Drop the old per-user unique (user_id, title) if it is still present.
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_user_title_key'
    ) THEN
        ALTER TABLE categories DROP CONSTRAINT categories_user_title_key;
    END IF;

    -- Add the parent-scoped unique. NULLS NOT DISTINCT treats two NULL parent_id
    -- roots of the same title as a conflict (only one root per title per user).
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'categories_user_parent_title_key'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT categories_user_parent_title_key
            UNIQUE NULLS NOT DISTINCT (user_id, parent_id, title);
    END IF;
END $$;
