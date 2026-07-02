-- =============================================================================
-- Migration: 0021_category_title_lowercase.sql
-- Purpose   : Backfill existing category titles to lowercase so category
--             filtering (array-overlap on the raw title path) matches the
--             lowercased filter facet. Fixes ?categories=rust returning 0 posts
--             when the stored title was "Rust" (created via the blog_agent path,
--             which previously did not normalize casing).
-- Contract  : ALL write paths now store lowercase — TS server
--             (validateCategoryInput.ts) + client (CategoryComboBox) already did;
--             blog_agent category.py normalized in lockstep with this migration.
-- Note      : MANUAL — apply to Supabase by hand (NOT auto-run by any code path).
--             Idempotent (re-running is a no-op once titles are already lower).
-- Pre-check : verified 0 case-folded (user_id, parent_id, title) collisions on
--             prod before authoring. The guard below aborts if any appear later,
--             so the UNIQUE(user_id, parent_id, title) constraint cannot be
--             violated by the UPDATE.
-- =============================================================================

DO $$
DECLARE
    collision_count integer;
BEGIN
    -- Abort if lowercasing would create a duplicate under the same parent.
    SELECT count(*) INTO collision_count FROM (
        SELECT 1
        FROM categories
        WHERE deleted_at IS NULL
        GROUP BY user_id, parent_id, lower(title)
        HAVING count(*) > 1
    ) dups;

    IF collision_count > 0 THEN
        RAISE EXCEPTION
            'Aborting: % case-folded (user_id, parent_id, title) collisions exist; resolve before lowercasing.',
            collision_count;
    END IF;

    UPDATE categories
    SET title = lower(title),
        updated_at = CURRENT_TIMESTAMP
    WHERE title <> lower(title)
      AND deleted_at IS NULL;
END $$;
