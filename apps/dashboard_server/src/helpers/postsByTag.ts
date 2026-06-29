// Purpose: keyset-paginated, slug-deduped post feed filtered by a single tag —
//          globally and scoped to one author. Mirrors the public feed read-row.
// Invariants:
//   * CRITICAL ordering — slug-dedup happens BEFORE the keyset: the inner CTE
//     computes ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at DESC)
//     over the FULL tag-filtered public set; the outer query then keeps rn=1 and
//     applies `id < cursor`. This guarantees a slug with multiple public
//     revisions whose ids straddle a page boundary appears EXACTLY once.
//   * Tag match is on the LIVE post_tags link (pt.deleted_at IS NULL).
//   * Public, non-deleted posts of non-deleted authors only; viewer-agnostic.
//   * The cursor is a STRING (BIGINT/Snowflake precision); NEVER Number()-ed.
//   * nextCursor = the last returned row's id as a STRING (null when exhausted).
// Side effects: one parameterized SELECT per call (read-only).
import type { Pool } from 'pg';
import type { TFeedPost, TTagFeedResponse } from '@repo/types';

// Max int8 — the default "start from the top" cursor (no id is >= it).
const MAX_CURSOR = '9223372036854775807';
const DEFAULT_FEED_LIMIT = 10;
const MAX_FEED_LIMIT = 50;

// Recursive CTE: each category's FULL root→leaf title path as a text[] (`path`),
// keyed by leaf id. LEFT JOIN on posts.category_id to return `category_path` for
// breadcrumb display (a soft-deleted ancestor breaks the chain → NULL path, card
// falls back to the single `category`). Goes right after `WITH ` (carries its own
// RECURSIVE keyword). Kept in lockstep with the same CTE in controllers/posts.
// title is varchar(100); cast to text in BOTH terms so the recursive `path`
// column is text[] in each (Postgres rejects varchar(100)[] vs varchar[] mix).
const CATEGORY_PATH_CTE = `RECURSIVE cat_path AS (
            SELECT id, parent_id, ARRAY[title::text] AS path
            FROM categories
            WHERE parent_id IS NULL AND deleted_at IS NULL
            UNION ALL
            SELECT c.id, c.parent_id, cp.path || c.title::text
            FROM categories c
            JOIN cat_path cp ON c.parent_id = cp.id
            WHERE c.deleted_at IS NULL
        )`;

// Normalize a raw `cursor` query value to a positive-integer STRING. Anything
// non-numeric (or '0') resets to the top sentinel. Never parses to a number —
// the value is bound as text and Postgres casts text -> int8 (precision-safe).
export function normalizeCursor(raw: unknown): string {
    const s = typeof raw === 'string' ? raw : '';
    return /^\d+$/.test(s) && s !== '0' ? s : MAX_CURSOR;
}

// Clamp a raw `limit` query value to [1, MAX] with a default (page size, not an id).
export function clampFeedLimit(
    raw: unknown,
    def: number = DEFAULT_FEED_LIMIT,
    max: number = MAX_FEED_LIMIT
): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
}

// Build the tag-feed SQL. Positional params:
//   global: $1 tag, $2 cursor, $3 limit
//   scoped: $1 tag, $2 username, $3 cursor, $4 limit
function buildTagFeedQuery(scoped: boolean): string {
    const usernameFilter = scoped ? 'AND u.username = $2' : '';
    const cursorParam = scoped ? '$3' : '$2';
    const limitParam = scoped ? '$4' : '$3';
    return `
        WITH ${CATEGORY_PATH_CTE},
        ranked_posts AS (
            SELECT
                p.id,
                p.user_id,
                u.username,
                p.slug,
                p.title,
                p.description,
                p.content,
                p.status,
                p.created_at,
                p.updated_at,
                p.category_id,
                f.stored_uri,
                c.title AS category,
                cpath.path AS category_path,
                p.created_at AS date,
                ROW_NUMBER() OVER(PARTITION BY p.slug ORDER BY p.created_at DESC) AS rn
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            INNER JOIN post_tags pt
                ON pt.post_id = p.id
                AND pt.tag_title = $1
                AND pt.deleted_at IS NULL
            LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN cat_path cpath ON cpath.id = p.category_id
            WHERE
                p.deleted_at IS NULL
                AND u.deleted_at IS NULL
                AND p.status = 'public'
                ${usernameFilter}
        )
        SELECT
            id,
            user_id,
            username,
            slug,
            title,
            description,
            content,
            status,
            created_at,
            updated_at,
            category_id,
            stored_uri,
            category,
            category_path,
            date,
            (SELECT ARRAY_AGG(pt.tag_title)
             FROM post_tags pt
             WHERE pt.post_id = ranked_posts.id
               AND pt.deleted_at IS NULL
            ) AS tags,
            (SELECT COUNT(*)
             FROM post_likes pl
             WHERE pl.post_id = ranked_posts.id
            )::int AS "likeCount",
            false AS "viewerLiked",
            (SELECT COUNT(*)::int FROM comments cc
              WHERE cc.post_id = ranked_posts.id
                AND cc.deleted_at IS NULL) AS "commentCount"
        FROM ranked_posts
        WHERE rn = 1
          AND id < ${cursorParam}
        ORDER BY id DESC
        LIMIT ${limitParam}
    `;
}

// Fetch a tag-filtered, slug-deduped, keyset page. `username` scopes to one author.
export async function listPostsByTag(
    pool: Pool,
    args: { tag: string; cursor: string; limit: number; username?: string }
): Promise<TTagFeedResponse> {
    const scoped = typeof args.username === 'string';
    const fetchLimit = args.limit + 1;
    const params = scoped
        ? [args.tag, args.username, args.cursor, fetchLimit]
        : [args.tag, args.cursor, fetchLimit];

    const { rows } = await pool.query<TFeedPost>(
        buildTagFeedQuery(scoped),
        params
    );

    const hasMore = rows.length > args.limit;
    const posts = hasMore ? rows.slice(0, args.limit) : rows;
    const nextCursor =
        hasMore && posts.length > 0
            ? String(posts[posts.length - 1].id)
            : null;

    return { posts, nextCursor, hasMore };
}
