// Purpose: write path for threaded comments (Option C — stored BIGINT[]
//          materialized path). createComment writes ONE comments row (path =
//          parent.path || newId, written once across two statements in a txn);
//          softDeleteComment sets deleted_at only (tombstone, body retained).
// Invariants:
//   * Isolation: every statement touches the `comments` table only (plus a
//     posts.user_id read for delete auth) — never posts.parent_id/group_id/level.
//   * user_id is ALWAYS the caller (owner-scoped) — never a client-supplied id.
//   * path is self-inclusive (path = parent.path || id) and written exactly once
//     (parent_id is immutable); depth = cardinality(path) - 1, derived only.
//   * A reply must attach to a LIVE comment on the SAME post (parent exists,
//     deleted_at IS NULL, post_id matches) — else the create is rejected.
//   * softDeleteComment NEVER hard-deletes; body/author/timestamps preserved.
// Side effects: a transaction per create/delete.
import type { Pool } from 'pg';
import type { TComment } from '@repo/types';
import {
    type TDb,
    type TCommentRow,
    CommentParentError,
    CommentForbiddenError,
    CommentNotFoundError,
    toComment,
} from './errors';

// Read one comment by id (post-scoped author lookup reuse). Returns null when
// absent. Used internally for the create parent-check and the delete auth-check.
async function findComment(
    db: TDb,
    commentId: string
): Promise<{
    id: string;
    post_id: string;
    user_id: string;
    path: string[];
    deleted_at: string | null;
} | null> {
    const { rows } = await db.query<{
        id: string;
        post_id: string;
        user_id: string;
        path: string[];
        deleted_at: string | null;
    }>(
        `SELECT id, post_id, user_id, path, deleted_at
         FROM comments
         WHERE id = $1`,
        [commentId]
    );
    return rows[0] ?? null;
}

// Create a comment (or reply). TRANSACTIONAL. For a reply, the parent must
// exist, be LIVE (deleted_at IS NULL), and belong to the SAME post. The path is
// computed from the server-generated id across TWO statements in the txn:
//   1) INSERT ... RETURNING id   (path placeholder '{}')
//   2) UPDATE path = parentPath || id  (self-inclusive), then project the row
// These MUST be separate statements. Sibling data-modifying CTEs share ONE
// snapshot, so an UPDATE in the same query as the INSERT cannot see the new
// row — it matches zero rows, the projection returns nothing, and toComment()
// throws on undefined (top-level: parentPath = '{}' → path = ARRAY[id]).
export async function createComment(
    db: Pool,
    userId: number,
    postId: string,
    parentId: string | null,
    body: string
): Promise<TComment> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        let parentPath: string[] = [];
        if (parentId !== null) {
            const parent = await findComment(client, parentId);
            if (
                parent === null ||
                parent.deleted_at !== null ||
                String(parent.post_id) !== String(postId)
            ) {
                throw new CommentParentError(
                    'parent comment must be a live comment on the same post'
                );
            }
            parentPath = parent.path.map(String);
        }

        // Statement 1: insert with a placeholder path, returning the
        // server-generated id (own statement — a sibling CTE could not see it).
        const inserted = await client.query<{ id: string }>(
            `INSERT INTO comments (post_id, user_id, parent_id, path, body)
             VALUES ($1, $2, $3, '{}', $4)
             RETURNING id`,
            [postId, userId, parentId, body]
        );
        const newId = inserted.rows[0]!.id;

        // Statement 2: set the self-inclusive path (parentPath || id) and
        // project the wire row. The row is now visible, so the UPDATE matches.
        const { rows } = await client.query<TCommentRow>(
            `WITH upd AS (
                UPDATE comments c
                SET path = $1::bigint[] || c.id
                WHERE c.id = $2
                RETURNING c.id, c.post_id, c.user_id, c.parent_id, c.path,
                          c.body, c.created_at, c.updated_at
             )
             SELECT
                upd.id,
                upd.post_id,
                upd.user_id,
                upd.parent_id,
                upd.path,
                cardinality(upd.path) - 1                AS depth,
                upd.body,
                false                                    AS is_deleted,
                COALESCE(u.display_name, u.username)     AS author_name,
                upd.created_at,
                upd.updated_at
             FROM upd
             JOIN users u ON u.id = upd.user_id`,
            [parentPath, newId]
        );

        await client.query('COMMIT');
        return toComment(rows[0]!);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Soft-delete a comment (tombstone). Sets deleted_at = now() ONLY — body,
// author, and timestamps are preserved verbatim (Rule 2). Authorized for the
// comment AUTHOR, the POST OWNER, or an ADMIN. Throws CommentNotFoundError when
// the id is unknown and CommentForbiddenError when the caller lacks rights.
// Returns the updated TComment (masked).
export async function softDeleteComment(
    db: Pool,
    commentId: string,
    userId: number,
    isAdmin: boolean
): Promise<TComment> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const target = await findComment(client, commentId);
        if (target === null) {
            throw new CommentNotFoundError('comment not found');
        }

        // Post owner may moderate any comment on their post.
        const { rows: postRows } = await client.query<{ user_id: string }>(
            `SELECT user_id FROM posts WHERE id = $1`,
            [target.post_id]
        );
        const postOwnerId = postRows[0]?.user_id;
        const isAuthor = String(target.user_id) === String(userId);
        const isPostOwner =
            postOwnerId !== undefined && String(postOwnerId) === String(userId);
        if (!isAuthor && !isPostOwner && !isAdmin) {
            throw new CommentForbiddenError('not allowed to delete this comment');
        }

        const { rows } = await client.query<TCommentRow>(
            `WITH del AS (
                UPDATE comments
                SET deleted_at = now()
                WHERE id = $1
                RETURNING id, post_id, user_id, parent_id, path, created_at, updated_at
             )
             SELECT
                del.id,
                del.post_id,
                del.user_id,
                del.parent_id,
                del.path,
                cardinality(del.path) - 1   AS depth,
                '[deleted]'                 AS body,
                true                        AS is_deleted,
                NULL                        AS author_name,
                del.created_at,
                del.updated_at
             FROM del`,
            [commentId]
        );

        await client.query('COMMIT');
        return toComment(rows[0]!);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
