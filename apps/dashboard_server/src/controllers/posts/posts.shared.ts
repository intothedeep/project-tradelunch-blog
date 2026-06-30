// Purpose: shared SQL fragments used across multiple posts read-route modules.
// Constraints: pure constants — no side effects, no imports beyond stdlib.
// Every posts read-route file that uses the recursive category-path CTE imports
// CATEGORY_PATH_CTE from here so the definition stays in exactly one place.

// Recursive CTE producing every category's FULL root→leaf title path as a
// text[] (`path`), keyed by leaf id. Feed queries LEFT JOIN it on
// posts.category_id to return `category_path` for breadcrumb display. A
// soft-deleted ANCESTOR breaks the chain → that leaf gets no path row and
// category_path is NULL (the card then falls back to the single `category`
// title). Goes right after `WITH ` (it carries its own RECURSIVE keyword).
// title is varchar(100); cast to text in BOTH terms so the recursive `path`
// column is text[] in each (Postgres rejects varchar(100)[] vs varchar[] mix).
// Root = parent_id NULL OR self-referencing (parent_id = id) — both conventions
// exist (see CategoryTree.buildCategoryTree); the recursive `c.id <> c.parent_id`
// guard stops a self-root from looping into itself.
export const CATEGORY_PATH_CTE = `RECURSIVE cat_path AS (
        SELECT id, parent_id, ARRAY[title::text] AS path
        FROM categories
        WHERE (parent_id IS NULL OR parent_id = id) AND deleted_at IS NULL
        UNION ALL
        SELECT c.id, c.parent_id, cp.path || c.title::text
        FROM categories c
        JOIN cat_path cp ON c.parent_id = cp.id AND c.id <> c.parent_id
        WHERE c.deleted_at IS NULL
    )`;
