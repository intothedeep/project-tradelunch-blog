// Purpose: log_likes toggle + state read for the Log micro-feed (Phase Y-M2).
//   Mirrors helpers/likes.ts (post_likes) onto the log_likes table.
// Invariants:
//   * Feature-guard: probes to_regclass('public.log_likes') once at boot;
//     caches result. When null (migration 0024 not applied), toggle returns
//     a 503 signal and getLogLikeState returns zero/unliked.
//   * log_id and user_id are BIGINT — kept as STRINGS end-to-end.
//   * toggleLogLike is idempotent per direction: INSERT ON CONFLICT DO NOTHING
//     means at most one like row; rowCount 0 triggers DELETE (unlike).
//   * likeCount is a fresh COUNT(*) inside the same transaction as the write.
//   * Rejects a like against a soft-deleted log node (deleted_at IS NOT NULL).
//   * Isolation: touches only log_likes and log — never posts or comments.
// Side effects: one transaction per toggleLogLike; one SELECT per getLogLikeState.
import type { Pool } from 'pg';
import type { TDb } from './errors';
import type { TLogLikeState } from '@repo/types';

// ---------------------------------------------------------------------------
// Presence guard — cached after first resolution.
// ---------------------------------------------------------------------------

let _likesTableReady: boolean | null = null;

export async function isLogLikesReady(db: TDb): Promise<boolean> {
    if (_likesTableReady !== null) return _likesTableReady;
    try {
        const { rows } = await db.query<{ exists: boolean }>(
            `SELECT (to_regclass('public.log_likes') IS NOT NULL) AS exists`
        );
        _likesTableReady = rows[0]?.exists ?? false;
    } catch {
        return false;
    }
    return _likesTableReady;
}

// Reset for testing only.
export function _resetLikesTableCache(): void {
    _likesTableReady = null;
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

async function countLogLikes(db: TDb, logId: string): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM log_likes WHERE log_id = $1`,
        [logId]
    );
    return Number(rows[0]?.count ?? '0');
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

// Toggle the caller's like for a log node.
// Returns null when the feature is not yet available (migration 0024 pending).
// Rejects (throws) when the target log node is soft-deleted.
export async function toggleLogLike(
    db: Pool,
    userId: number,
    logId: string
): Promise<TLogLikeState | null> {
    if (!(await isLogLikesReady(db))) return null;

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Reject likes against deleted nodes.
        const { rows: nodeRows } = await client.query<{
            deleted_at: string | null;
        }>(`SELECT deleted_at FROM log WHERE id = $1`, [logId]);
        if (nodeRows.length === 0) {
            await client.query('ROLLBACK');
            throw Object.assign(new Error('log node not found'), {
                code: 'LOG_NOT_FOUND',
            });
        }
        if (nodeRows[0]!.deleted_at !== null) {
            await client.query('ROLLBACK');
            throw Object.assign(new Error('cannot like a deleted log node'), {
                code: 'LOG_DELETED',
            });
        }

        const inserted = await client.query(
            `INSERT INTO log_likes (user_id, log_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, log_id) DO NOTHING`,
            [userId, logId]
        );

        let liked: boolean;
        if ((inserted.rowCount ?? 0) > 0) {
            liked = true;
        } else {
            await client.query(
                `DELETE FROM log_likes WHERE user_id = $1 AND log_id = $2`,
                [userId, logId]
            );
            liked = false;
        }

        const likeCount = await countLogLikes(client, logId);
        await client.query('COMMIT');
        return { liked, likeCount };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Read the like state for a log node.
// viewerId: when provided, also returns whether that viewer liked the node.
//           When absent (anonymous), liked is always false.
export async function getLogLikeState(
    db: TDb,
    logId: string,
    viewerId?: number
): Promise<TLogLikeState> {
    if (!(await isLogLikesReady(db))) {
        return { liked: false, likeCount: 0 };
    }

    if (viewerId !== undefined) {
        const { rows } = await db.query<{ liked: boolean; count: string }>(
            `SELECT
                EXISTS (
                    SELECT 1 FROM log_likes
                    WHERE log_id = $1 AND user_id = $2
                ) AS liked,
                (SELECT COUNT(*)::text FROM log_likes WHERE log_id = $1) AS count`,
            [logId, viewerId]
        );
        return {
            liked: rows[0]?.liked ?? false,
            likeCount: Number(rows[0]?.count ?? '0'),
        };
    }

    const likeCount = await countLogLikes(db, logId);
    return { liked: false, likeCount };
}
