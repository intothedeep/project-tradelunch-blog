// Purpose: resolve a verified Clerk identity to a finance-local `users` row —
//          read-first, else CREATE. finance's users table is greenfield (no
//          seed/import rows), so unlike the blog there is NO email-adoption
//          step: clerk_user_id is the sole join key.
// Invariants:
//   * Fast path is a single SELECT — no write on the hot path (already-linked).
//   * INSERT is conflict-safe on clerk_user_id (concurrent first-sight → one wins).
//   * is_admin is sourced HERE (our DB), never from Clerk metadata. New rows
//     default is_admin=false; grant via SQL (see 0002_users.sql bootstrap note).
//   * Returns null only when the sole row for this clerk_user_id is soft-deleted
//     (caller maps that to unauthenticated/unprovisioned).
// Side effects: 1 SELECT always; on first sight, one INSERT + a reread.
import type { Pool, PoolClient } from 'pg';

type TDb = Pool | PoolClient;

export type TUserIdentityRow = {
    id: string; // BIGINT → pg returns string; never Number() a BIGINT id.
    username: string | null;
    is_admin: boolean;
};

export type TClerkProfile = {
    clerkUserId: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    email: string | null;
};

const SELECT_BY_CLERK = `SELECT id, username, is_admin
   FROM users
  WHERE clerk_user_id = $1 AND deleted_at IS NULL
  LIMIT 1`;

export async function provisionUser(
    db: TDb,
    profile: TClerkProfile
): Promise<TUserIdentityRow | null> {
    // 1. Fast path: already linked. No write — almost every request.
    const linked = await db.query<TUserIdentityRow>(SELECT_BY_CLERK, [
        profile.clerkUserId,
    ]);
    if (linked.rows[0]) return linked.rows[0];

    // 2. First sight: provision a new row. Conflict-safe on clerk_user_id.
    const created = await db.query<TUserIdentityRow>(
        `INSERT INTO users (clerk_user_id, username, display_name, avatar_url, email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (clerk_user_id) DO NOTHING
         RETURNING id, username, is_admin`,
        [
            profile.clerkUserId,
            profile.username,
            profile.displayName,
            profile.avatarUrl,
            profile.email,
        ]
    );
    if (created.rows[0]) return created.rows[0];

    // 3. Race (a concurrent first-sight created it) or soft-deleted-only row
    //    (→ null → caller returns unauthenticated).
    const reread = await db.query<TUserIdentityRow>(SELECT_BY_CLERK, [
        profile.clerkUserId,
    ]);
    return reread.rows[0] ?? null;
}
