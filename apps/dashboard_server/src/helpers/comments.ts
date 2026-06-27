// Purpose: raw-SQL service for threaded comments (Option C — stored BIGINT[]
//          materialized path, UNLIMITED depth). createComment writes ONE
//          comments row (path = parent.path || newId, written once); listCommentTree
//          returns the whole thread in pre-order DFS via a plain
//          `WHERE post_id=$1 ORDER BY path` (NO recursive CTE); softDeleteComment
//          sets deleted_at only (tombstone, masked at READ — body retained).
// Invariants:
//   * Isolation (Issue #1 G1/G2/G3): every statement touches the `comments`
//     table only — it NEVER reads or writes posts.parent_id/group_id/level.
//     comments.parent_id self-references comments(id), never posts(id).
//   * ids are Snowflake BIGINT — kept as STRINGS end-to-end (node-pg returns
//     int8 as a string; never Number()-ed, which truncates past MAX_SAFE_INTEGER).
//   * user_id is ALWAYS the caller (owner-scoped) — never a client-supplied id.
//   * path is self-inclusive (path = parent.path || id) and written exactly once
//     (parent_id is immutable); depth = cardinality(path) - 1 (0 = top-level),
//     derived for indentation, NEVER an enforced cap.
//   * A reply must attach to a LIVE comment on the SAME post (parent exists,
//     deleted_at IS NULL, post_id matches) — else the create is rejected.
//   * Tombstone read-mask: a deleted comment stays in path order with its body
//     masked to '[deleted]' and isDeleted=true; the original body never leaves
//     the DB. softDeleteComment NEVER hard-deletes.
// Side effects: a transaction per createComment; single SELECT/UPDATE otherwise.
import type { Pool, PoolClient } from 'pg';
import type { TComment } from '@repo/types';

type TDb = Pool | PoolClient;

// A row from the comment-tree read. Snowflake ids stay strings; path is a
// string[] of those ids; is_deleted/author_name are projected per Rule 2.
interface TCommentRow {
    id: string;
    post_id: string;
    user_id: string;
    parent_id: string | null;
    path: string[];
    depth: string;
    body: string;
    is_deleted: boolean;
    author_name: string | null;
    created_at: string;
}

export class CommentParentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentParentError';
    }
}

export class CommentForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentForbiddenError';
    }
}

export class CommentNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentNotFoundError';
    }
}

// Map a read row to the wire shape. Tombstoned rows expose body '[deleted]'
// (masked in SQL) and drop the author name (authorName omitted).
function toComment(row: TCommentRow): TComment {
    const base: TComment = {
        id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        parentId: row.parent_id === null ? null : String(row.parent_id),
        path: row.path.map(String),
        depth: Number(row.depth),
        body: row.body,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
    };
    if (!row.is_deleted && row.author_name) {
        base.authorName = row.author_name;
    }
    return base;
}

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
                          c.body, c.created_at
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
                upd.created_at
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
                RETURNING id, post_id, user_id, parent_id, path, created_at
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
                del.created_at
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
