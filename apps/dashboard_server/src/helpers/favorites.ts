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
