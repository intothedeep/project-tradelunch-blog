// Purpose: write path for the Log micro-feed (Phase Y — stored BIGINT[]
//          materialized path). createLog writes ONE log row (path = parent.path
//          || newId, written once across two statements in a txn); softDeleteLog
//          sets deleted_at only (tombstone, body retained).
// Invariants:
//   * Isolation: every statement touches the `log` table only (plus a
//     log.user_id lookup for mutate-auth) — never posts/comments.
//   * user_id is ALWAYS the caller (owner-scoped) — never a client-supplied id.
//   * path is self-inclusive (path = parent.path || id) and written exactly once
//     (parent_id is immutable); depth = cardinality(path) - 1, derived only.
//   * A reply must attach to a LIVE log node (parent exists, deleted_at IS NULL)
//     — else createLog throws LogParentError (400).
//   * softDeleteLog NEVER hard-deletes; body/author/timestamps preserved.
//   * Delete authorization: comment AUTHOR, LOG-STREAM OWNER (root's user_id),
//     or ADMIN — implemented in assertLogMutable.
//   * The 2-statement path trap (same as comments/write.ts:114-149): a sibling
//     CTE cannot see its own INSERT in the same query snapshot, so the path
//     update MUST be a separate statement after the INSERT.
// Side effects: a transaction per create/delete.
import type { Pool } from 'pg';
import type { TLog } from '@repo/types';
import {
    type TDb,
    type TLogRow,
    LogParentError,
    LogForbiddenError,
    LogNotFoundError,
    toLog,
} from './errors';

// Read one log node by id, returning the minimal shape needed for auth/path
// checks. Returns null when absent.
async function findLog(
    db: TDb,
    logId: string
): Promise<{
    id: string;
    user_id: string;
    path: string[];
    deleted_at: string | null;
} | null> {
    const { rows } = await db.query<{
        id: string;
        user_id: string;
        path: string[];
        deleted_at: string | null;
    }>(
        `SELECT id, user_id, path, deleted_at
         FROM log
         WHERE id = $1`,
        [logId]
    );
    return rows[0] ?? null;
}

// Shared mutate-authorization gate for delete. Allows the log node AUTHOR,
// the LOG-STREAM OWNER (the user_id of path[0] — the root top-level node), or
// an ADMIN; throws LogForbiddenError otherwise.
// Why root owner = stream owner: all replies under a top-level log post belong
// to the same stream. The stream owner has moderation rights over that whole
// subtree (mirrors comments assertCommentMutable with post-owner).
export async function assertLogMutable(
    db: TDb,
    target: { user_id: string; path: string[] },
    callerId: number,
    isAdmin: boolean
): Promise<void> {
    const isAuthor = String(target.user_id) === String(callerId);
    if (isAuthor || isAdmin) return;

    // Look up the root (path[0]) owner only when the caller is not the author.
    const rootId = target.path[0];
    if (rootId !== undefined) {
        const { rows } = await db.query<{ user_id: string }>(
            `SELECT user_id FROM log WHERE id = $1`,
            [rootId]
        );
        const rootOwnerId = rows[0]?.user_id;
        if (
            rootOwnerId !== undefined &&
            String(rootOwnerId) === String(callerId)
        ) {
            return;
        }
    }
    throw new LogForbiddenError('not allowed to mutate this log node');
}

// Create a log node (top-level or reply). TRANSACTIONAL.
// For a reply, the parent must exist and be LIVE (deleted_at IS NULL).
// Path is computed from the server-generated id in TWO statements (same trap as
// comments/write.ts:114-149: a sibling CTE cannot see its own INSERT).
//   1) INSERT ... RETURNING id   (path placeholder '{}')
//   2) UPDATE path = parentPath || id  (self-inclusive), project the wire row
export async function createLog(
    db: Pool,
    userId: number,
    parentId: string | null,
    body: string
): Promise<TLog> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        let parentPath: string[] = [];
        if (parentId !== null) {
            const parent = await findLog(client, parentId);
            if (parent === null || parent.deleted_at !== null) {
                throw new LogParentError(
                    'parent log node must exist and be live'
                );
            }
            parentPath = parent.path.map(String);
        }

        // Statement 1: insert with placeholder path, return server-generated id.
        const inserted = await client.query<{ id: string }>(
            `INSERT INTO log (user_id, parent_id, path, body)
             VALUES ($1, $2, '{}', $3)
             RETURNING id`,
            [userId, parentId, body]
        );
        const newId = inserted.rows[0]!.id;

        // Statement 2: set the self-inclusive path (parentPath || id) and
        // project the full wire row. The new row is visible now.
        const { rows } = await client.query<TLogRow>(
            `WITH upd AS (
                UPDATE log l
                SET path = $1::bigint[] || l.id
                WHERE l.id = $2
                RETURNING l.id, l.user_id, l.parent_id, l.path, l.body, l.created_at
             )
             SELECT
                upd.id,
                upd.user_id,
                upd.parent_id,
                upd.path,
                cardinality(upd.path) - 1                AS depth,
                upd.body,
                false                                    AS is_deleted,
                COALESCE(u.display_name, u.username)     AS author_name,
                u.username                               AS author_username,
                upd.created_at
             FROM upd
             JOIN users u ON u.id = upd.user_id`,
            [parentPath, newId]
        );

        await client.query('COMMIT');
        return toLog(rows[0]!);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Soft-delete a log node (tombstone). Sets deleted_at = now() ONLY — body,
// author, and timestamps are preserved verbatim. Authorized for the node
// AUTHOR, the LOG-STREAM OWNER, or an ADMIN. Throws LogNotFoundError when the
// id is unknown, LogForbiddenError when the caller lacks rights.
export async function softDeleteLog(
    db: Pool,
    logId: string,
    userId: number,
    isAdmin: boolean
): Promise<TLog> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const target = await findLog(client, logId);
        if (target === null) {
            throw new LogNotFoundError('log node not found');
        }
        await assertLogMutable(client, target, userId, isAdmin);

        const { rows } = await client.query<TLogRow>(
            `WITH del AS (
                UPDATE log
                SET deleted_at = now()
                WHERE id = $1
                RETURNING id, user_id, parent_id, path, created_at
             )
             SELECT
                del.id,
                del.user_id,
                del.parent_id,
                del.path,
                cardinality(del.path) - 1   AS depth,
                '[deleted]'                 AS body,
                true                        AS is_deleted,
                NULL                        AS author_name,
                NULL                        AS author_username,
                del.created_at
             FROM del`,
            [logId]
        );

        await client.query('COMMIT');
        return toLog(rows[0]!);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
