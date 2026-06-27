// Purpose: caller-scoped raw-SQL operations against post_favorites (list / add /
//          remove). Every statement is bound to user_id = $caller, so a user can
//          only ever read or mutate their OWN favorites — there is no parameter
//          for another user's id. This is also the auth test seam: tests call
//          these helpers directly with a known userId instead of a Clerk token.
// Invariants:
//   * post_id is a Snowflake BIGINT — kept as a STRING end-to-end (never cast to
//     Number, which would truncate beyond MAX_SAFE_INTEGER). node-pg returns
//     int8/BIGINT as a JS string by default, which we preserve.
//   * addFavorite is idempotent (ON CONFLICT DO NOTHING) — a double-save never
//     creates a duplicate row.
// Side effects: a single parameterized SQL statement per call.
import type { Pool, PoolClient } from 'pg';

type TDb = Pool | PoolClient;

// Returns the caller's favorited post ids (newest first) as strings.
export async function listFavoritePostIds(
    db: TDb,
    userId: number
): Promise<string[]> {
    const { rows } = await db.query<{ post_id: string }>(
        `SELECT post_id
         FROM post_favorites
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows.map((row) => String(row.post_id));
}

// Idempotent insert of (caller, post). Returns true when a new row was created,
// false when it already existed (ON CONFLICT DO NOTHING).
export async function addFavorite(
    db: TDb,
    userId: number,
    postId: string
): Promise<boolean> {
    const { rowCount } = await db.query(
        `INSERT INTO post_favorites (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId]
    );
    return (rowCount ?? 0) > 0;
}

// Removes the (caller, post) favorite. Returns true when a row was deleted.
export async function removeFavorite(
    db: TDb,
    userId: number,
    postId: string
): Promise<boolean> {
    const { rowCount } = await db.query(
        `DELETE FROM post_favorites
         WHERE user_id = $1 AND post_id = $2`,
        [userId, postId]
    );
    return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Saved-posts list (GET /v1/api/favorites/posts) — owner-scoped full post
// cards for the caller's saved set, keyset-paginated newest-saved first with
// optional title/description search.
//
// Invariants (additional to the file header):
//   * Owner scope: bound to pf.user_id = $1 = the caller. No client-supplied id.
//   * Soft-delete Rule-1: excludes p.deleted_at / u.deleted_at and non-public
//     posts, so a saved post that became private/draft/deleted never surfaces
//     (fixes the favorites.ts list join gap; the saver is a public reader).
//   * Keyset cursor is the LAST row's saved_at ISO STRING. saved_at and id are
//     bound as strings — the Snowflake id is NEVER Number()-ed (precision).
// Side effects: a single parameterized SELECT.
// ---------------------------------------------------------------------------

const DEFAULT_SAVED_LIMIT = 20;
const MAX_SAVED_LIMIT = 50;

export interface TSavedPostsParams {
    query?: string | null;
    cursor?: string | null;
    limit?: number;
}

// A saved-post card row — the SAME column shape the public feed returns for
// RecentPostCard, plus saved_at (the keyset/cursor key). Snowflake ids stay
// strings (node-pg int8 → string).
export interface TSavedPostRow {
    id: string;
    user_id: number;
    username: string | null;
    slug: string;
    title: string;
    description: string | null;
    content: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    category_id: string | null;
    stored_uri: string | null;
    category: string | null;
    date: string;
    tags: string[] | null;
    saved_at: string;
}

export interface TSavedPostsResult {
    posts: TSavedPostRow[];
    nextCursor: string | null;
}

// Clamp the page size into [1, MAX_SAVED_LIMIT], defaulting when absent/invalid.
function clampSavedLimit(limit?: number): number {
    if (!Number.isFinite(limit) || (limit as number) <= 0) {
        return DEFAULT_SAVED_LIMIT;
    }
    return Math.min(Math.floor(limit as number), MAX_SAVED_LIMIT);
}

// Trim a search term; an empty/blank term means "no filter" (null).
function normalizeSavedQuery(query?: string | null): string | null {
    if (typeof query !== 'string') return null;
    const trimmed = query.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function listSavedPosts(
    db: TDb,
    userId: number,
    params: TSavedPostsParams = {}
): Promise<TSavedPostsResult> {
    const limit = clampSavedLimit(params.limit);
    const search = normalizeSavedQuery(params.query);
    // Cursor is the previous page's last saved_at (ISO string) — bound as a
    // timestamptz, NEVER coerced to a number. null = first page.
    const cursor =
        typeof params.cursor === 'string' && params.cursor.length > 0
            ? params.cursor
            : null;
    const fetchLimit = limit + 1;

    const sql = `
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
            p.created_at AS date,
            pf.created_at AS saved_at,
            (SELECT ARRAY_AGG(pt.tag_title)
               FROM post_tags pt
              WHERE pt.post_id = p.id
                AND pt.deleted_at IS NULL) AS tags
        FROM post_favorites pf
        INNER JOIN posts p ON p.id = pf.post_id
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN files f ON f.post_id = p.id AND f.is_thumbnail = true
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE pf.user_id = $1
          AND p.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND p.status = 'public'
          AND ($2::text IS NULL
               OR p.title ILIKE '%' || $2 || '%'
               OR p.description ILIKE '%' || $2 || '%')
          AND ($3::timestamptz IS NULL
               OR pf.created_at < $3::timestamptz)
        ORDER BY pf.created_at DESC, p.id DESC
        LIMIT $4
    `;

    const { rows } = await db.query<TSavedPostRow>(sql, [
        userId,
        search,
        cursor,
        fetchLimit,
    ]);

    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
        hasMore && posts.length > 0
            ? new Date(posts[posts.length - 1]!.saved_at).toISOString()
            : null;

    return { posts, nextCursor };
}
