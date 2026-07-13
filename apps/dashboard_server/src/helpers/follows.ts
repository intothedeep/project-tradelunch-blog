// Purpose: follows table helper (Phase Y-M2). follower→followee relationship.
//   Soft-delete pattern: re-follow = ON CONFLICT DO UPDATE SET deleted_at = NULL.
//   Self-follow is rejected at both the DB level (CHECK constraint) and here (400).
// Invariants:
//   * Feature-guard: probes to_regclass('public.follows') once at boot; caches.
//   * BIGINT ids are STRINGS end-to-end (never Number()/parseInt).
//   * Soft-delete respected: active follow = deleted_at IS NULL.
//   * Isolation: touches only follows and users tables.
// Side effects: DB reads/writes via the injected TDb/Pool handle.
import type { Pool, PoolClient } from 'pg';
import type { TLogFollowState } from '@repo/types';

type TDb = Pool | PoolClient;

// ---------------------------------------------------------------------------
// Presence guard — cached after first resolution.
// ---------------------------------------------------------------------------

let _followsTableReady: boolean | null = null;

export async function isFollowsReady(db: TDb): Promise<boolean> {
    if (_followsTableReady !== null) return _followsTableReady;
    try {
        const { rows } = await db.query<{ exists: boolean }>(
            `SELECT (to_regclass('public.follows') IS NOT NULL) AS exists`
        );
        _followsTableReady = rows[0]?.exists ?? false;
    } catch {
        return false;
    }
    return _followsTableReady;
}

// Reset for testing only.
export function _resetFollowsTableCache(): void {
    _followsTableReady = null;
}

// ---------------------------------------------------------------------------
// Internal count helpers.
// ---------------------------------------------------------------------------

async function countFollowers(db: TDb, userId: number): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM follows
         WHERE followee_id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    return Number(rows[0]?.count ?? '0');
}

async function countFollowees(db: TDb, userId: number): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM follows
         WHERE follower_id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    return Number(rows[0]?.count ?? '0');
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

// Toggle follow: followerId starts following / unfollows followeeId.
// Re-follow (previously unfollowed) resets deleted_at to NULL.
// Returns null when the feature is not yet available (migration 0024 pending).
// Throws when followerId === followeeId (self-follow — 400 from controller).
export async function toggleFollow(
    db: Pool,
    followerId: number,
    followeeId: number
): Promise<TLogFollowState | null> {
    if (followerId === followeeId) {
        throw Object.assign(new Error('cannot follow yourself'), {
            code: 'SELF_FOLLOW',
        });
    }

    if (!(await isFollowsReady(db))) return null;

    // Upsert: insert a new follow OR revive a deleted one.
    // If the row exists and deleted_at IS NULL → unfollow (set deleted_at = now()).
    // If the row exists and deleted_at IS NOT NULL → re-follow (clear deleted_at).
    // If no row → insert (new follow).
    const { rows } = await db.query<{
        follower_id: string;
        followee_id: string;
        deleted_at: string | null;
    }>(
        `INSERT INTO follows (follower_id, followee_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, followee_id) DO UPDATE
             SET deleted_at = CASE
                 WHEN follows.deleted_at IS NULL THEN now()
                 ELSE NULL
             END
         RETURNING follower_id, followee_id, deleted_at`,
        [followerId, followeeId]
    );

    const following = rows[0]?.deleted_at === null;
    const [followerCount, followeeCount] = await Promise.all([
        countFollowers(db, followeeId),
        countFollowees(db, followeeId),
    ]);
    return { following, followerCount, followeeCount };
}

// Read the follow state from followerId's perspective toward targetId.
// Returns inert state (following=false, counts=0) when table is absent.
export async function getFollowState(
    db: TDb,
    viewerId: number,
    targetId: number
): Promise<TLogFollowState> {
    if (!(await isFollowsReady(db))) {
        return { following: false, followerCount: 0, followeeCount: 0 };
    }

    const [{ rows }, followerCount, followeeCount] = await Promise.all([
        db.query<{ following: boolean }>(
            `SELECT EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = $1 AND followee_id = $2
                  AND deleted_at IS NULL
             ) AS following`,
            [viewerId, targetId]
        ),
        countFollowers(db, targetId),
        countFollowees(db, targetId),
    ]);

    return {
        following: rows[0]?.following ?? false,
        followerCount,
        followeeCount,
    };
}

// Returns the set of user ids that followerId actively follows (deleted_at IS NULL).
// Used by the timeline helper to scope the fan-in query.
// Returns empty array when feature is not yet available.
export async function listFolloweeIds(
    db: TDb,
    followerId: number
): Promise<string[]> {
    if (!(await isFollowsReady(db))) return [];

    const { rows } = await db.query<{ followee_id: string }>(
        `SELECT followee_id::text AS followee_id FROM follows
         WHERE follower_id = $1 AND deleted_at IS NULL`,
        [followerId]
    );
    return rows.map((r) => r.followee_id);
}
