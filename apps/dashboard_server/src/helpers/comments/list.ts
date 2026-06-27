// Purpose: read path for threaded comments (Option C — stored BIGINT[]
//          materialized path). listCommentTree returns the whole thread in
//          pre-order DFS via a plain `WHERE post_id=$1 ORDER BY path` (NO
//          recursive CTE).
// Invariants:
//   * Isolation: every statement touches the `comments` table only — it NEVER
//     reads or writes posts.parent_id/group_id/level.
//   * Tombstones are RETURNED (subtree survives) with body masked to '[deleted]'
//     and author nulled; the original body never leaves the DB.
// Side effects: a single SELECT.
import type { TComment } from '@repo/types';
import { type TDb, type TCommentRow, toComment } from './errors';

// Read the entire comment thread for a post in pre-order DFS. No recursive CTE:
// the stored BIGINT[] path sorts element-wise, so ORDER BY path IS the tree
// order (served by idx_comments_post_path). Tombstones are RETURNED (subtree
// survives) with body masked to '[deleted]' and author nulled.
export async function listCommentTree(
    db: TDb,
    postId: string
): Promise<TComment[]> {
    const { rows } = await db.query<TCommentRow>(
        `SELECT
            c.id,
            c.post_id,
            c.user_id,
            c.parent_id,
            c.path,
            cardinality(c.path) - 1                                    AS depth,
            CASE WHEN c.deleted_at IS NOT NULL
                 THEN '[deleted]' ELSE c.body END                     AS body,
            (c.deleted_at IS NOT NULL)                                AS is_deleted,
            CASE WHEN c.deleted_at IS NOT NULL THEN NULL
                 ELSE COALESCE(u.display_name, u.username) END        AS author_name,
            c.created_at
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = $1
         ORDER BY c.path`,
        [postId]
    );
    return rows.map(toComment);
}
