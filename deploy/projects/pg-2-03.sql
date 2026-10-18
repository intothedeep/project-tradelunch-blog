-- PG-2-03: project groups data move (projects.design.md §12.6, #119).
-- Run ONCE, after the PG-2-01 deploy (4c4a73e). One transaction: SQL A + SQL B.
-- Executed by the main session after owner OK. No row is deleted.
\set ON_ERROR_STOP on

BEGIN;

-- 0. Pre-check: root and cnn are where we expect; no group title exists yet.
--    Expected: 1 root row, cnn parent = root, 0 existing group rows.
SELECT id::text, title, level, parent_id::text FROM categories
WHERE id IN ('368565571240857600', '368565576462766080') AND deleted_at IS NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM categories
      WHERE parent_id = '368565571240857600' AND deleted_at IS NULL
        AND title IN ('my-work', 'company', 'gatech', 'utrgv')) <> 0 THEN
    RAISE EXCEPTION 'group rows already exist';
  END IF;
  IF (SELECT parent_id FROM categories WHERE id = '368565576462766080') <> '368565571240857600' THEN
    RAISE EXCEPTION 'cnn-from-scratch is not directly under projects';
  END IF;
END $$;

-- A. Four groups under the root. id = DB identity default (owner Q-PG3 "ok").
--    group_id = root id, like blog_agent children.
INSERT INTO categories (group_id, parent_id, level, priority, title, user_id)
SELECT r.id, r.id, 1, g.priority, g.title, r.user_id
FROM categories r,
     (VALUES (10, 'my-work'), (20, 'company'), (30, 'gatech'), (40, 'utrgv')) AS g(priority, title)
WHERE r.id = '368565571240857600' AND r.deleted_at IS NULL;

-- B. Move cnn-from-scratch under utrgv.
UPDATE categories SET parent_id = (SELECT id FROM categories
       WHERE parent_id = '368565571240857600' AND title = 'utrgv' AND deleted_at IS NULL),
       level = 2, updated_at = CURRENT_TIMESTAMP
WHERE id = '368565576462766080';

-- Post-check: 4 groups + cnn under utrgv.
SELECT c.id::text, c.title, c.level, c.priority, p.title AS parent
FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
WHERE c.parent_id = '368565571240857600' OR c.id = '368565576462766080'
ORDER BY c.level, c.priority;

COMMIT;

-- Rollback (do NOT run unless reverting; soft-delete only):
-- BEGIN;
-- UPDATE categories SET parent_id = '368565571240857600', level = 1, updated_at = CURRENT_TIMESTAMP
--   WHERE id = '368565576462766080';
-- UPDATE categories SET deleted_at = CURRENT_TIMESTAMP
--   WHERE parent_id = '368565571240857600' AND title IN ('my-work','company','gatech','utrgv')
--     AND deleted_at IS NULL;
-- COMMIT;
-- then ./_scripts/cloudflare/cf-purge.sh
