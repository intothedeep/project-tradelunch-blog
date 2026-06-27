// Purpose: caller-scoped raw-SQL like toggle against post_likes. A like is a
//          PUBLIC approval signal — toggleLike flips the caller's like for a
//          post and returns the resulting state plus a LIVE COUNT(*) (no
//          denormalized counter). Every statement is bound to user_id =
//          $caller, so a user can only ever toggle their OWN like — there is no
//          parameter for another user's id.
// Invariants:
//   * post_id is a Snowflake BIGINT — kept as a STRING end-to-end (never cast to
//     Number, which would truncate beyond MAX_SAFE_INTEGER).
//   * toggleLike is idempotent per call direction: INSERT ON CONFLICT DO NOTHING
//     means a like is created at most once; when the row already exists the
//     toggle removes it (unlike). like→unlike→like returns to the liked state.
//   * likeCount is a fresh COUNT(*) read inside the same transaction as the
//     write, so the returned count reflects this toggle and cannot drift.
// Side effects: a transaction (BEGIN/COMMIT) per toggleLike; a single SELECT per
//   getLikeState.
import type { Pool, PoolClient } from 'pg';

type TDb = Pool | PoolClient;

export interface TLikeState {
    liked: boolean;
    likeCount: number;
}

// Live count of likes for a post (the public like count).
async function countLikes(db: TDb, postId: string): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM post_likes
         WHERE post_id = $1`,
        [postId]
    );
    return Number(rows[0]?.count ?? '0');
}

// Toggle the caller's like for a post and return the resulting state + live
// count. INSERT ON CONFLICT DO NOTHING: rowCount > 0 = a new like was created;
// rowCount 0 = the like already existed → remove it (unlike). The write and the
// COUNT(*) run in one transaction so the returned count reflects this toggle.
export async function toggleLike(
    db: Pool,
    userId: number,
    postId: string
): Promise<TLikeState> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const inserted = await client.query(
            `INSERT INTO post_likes (user_id, post_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, post_id) DO NOTHING`,
            [userId, postId]
        );

        let liked: boolean;
        if ((inserted.rowCount ?? 0) > 0) {
            liked = true;
        } else {
            await client.query(
                `DELETE FROM post_likes
                 WHERE user_id = $1 AND post_id = $2`,
                [userId, postId]
            );
            liked = false;
        }

        const likeCount = await countLikes(client, postId);
        await client.query('COMMIT');
        return { liked, likeCount };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Returns the caller's liked post ids as strings. Owner-scoped: bound to
// user_id = $caller, so a user only ever reads their OWN likes. The client
// consumes this as a membership Set, so no ordering is needed.
export async function listLikedPostIds(
    db: TDb,
    userId: number
): Promise<string[]> {
    const { rows } = await db.query<{ post_id: string }>(
        `SELECT post_id
         FROM post_likes
         WHERE user_id = $1`,
        [userId]
    );
    return rows.map((row) => String(row.post_id));
}

// Read the caller's like state for a post (did I like it + the live count).
// Owner-scoped: the `liked` flag is bound to user_id = $caller.
export async function getLikeState(
    db: TDb,
    userId: number,
    postId: string
): Promise<TLikeState> {
    const { rows } = await db.query<{ liked: boolean; count: string }>(
        `SELECT
            EXISTS (
                SELECT 1 FROM post_likes
                WHERE post_id = $1 AND user_id = $2
            ) AS liked,
            (SELECT COUNT(*)::text FROM post_likes WHERE post_id = $1) AS count`,
        [postId, userId]
    );
    return {
        liked: rows[0]?.liked ?? false,
        likeCount: Number(rows[0]?.count ?? '0'),
    };
}
