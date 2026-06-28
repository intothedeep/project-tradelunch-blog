// Purpose: resolve a verified Clerk identity to a users row — read-first, then
//          ADOPT an existing email-matched row (unlinked), else CREATE one.
//          Email-adoption links a pre-existing import/seed row (email set,
//          clerk_user_id NULL) to the live Clerk login — the email is the join
//          key between "our user" and "the Clerk user".
// Invariants:
//   * The verified email is supplied lazily via `fetchEmail`, invoked ONLY on a
//     first-sight miss — zero network cost on the hot path (already-linked user).
//   * Adoption only ever touches a row with clerk_user_id IS NULL (never steals a
//     row already bound to another Clerk account).
//   * Returns null only when the sole row for this clerk_user_id is soft-deleted
//     (caller maps that to 'unprovisioned').
// Side effects: 1 SELECT always; on first sight, fetchEmail + one UPDATE/INSERT.
import type { Pool, PoolClient } from 'pg';

type TDb = Pool | PoolClient;

export type TUserIdentityRow = {
    id: number;
    username: string | null;
    is_admin: boolean;
};

const SELECT_BY_CLERK = `SELECT id, username, is_admin
   FROM users
  WHERE clerk_user_id = $1 AND deleted_at IS NULL
  LIMIT 1`;

const UNIQUE_VIOLATION = '23505';

export async function provisionUser(
    db: TDb,
    clerkUserId: string,
    fetchEmail: () => Promise<string | null>
): Promise<TUserIdentityRow | null> {
    // 1. Fast path: already linked. No email fetch, no write — almost every request.
    const linked = await db.query<TUserIdentityRow>(SELECT_BY_CLERK, [
        clerkUserId,
    ]);
    if (linked.rows[0]) return linked.rows[0];

    // 2. First sight: fetch the verified email (availability-first → may be null).
    const email = await fetchEmail();

    // 3. Adopt an UNLINKED row matched by email (case-insensitive). The
    //    clerk_user_id IS NULL guard blocks taking over an already-linked row.
    if (email) {
        const adopted = await db.query<TUserIdentityRow>(
            `UPDATE users SET clerk_user_id = $1, updated_at = now()
              WHERE lower(email) = lower($2)
                AND clerk_user_id IS NULL
                AND deleted_at IS NULL
             RETURNING id, username, is_admin`,
            [clerkUserId, email]
        );
        if (adopted.rows[0]) return adopted.rows[0];
    }

    // 4. Provision a new row. Conflict-safe on clerk_user_id; a colliding
    //    UNIQUE(email) (email already on another account) → retry without email.
    try {
        const created = await db.query<TUserIdentityRow>(
            `INSERT INTO users (clerk_user_id, email) VALUES ($1, $2)
             ON CONFLICT (clerk_user_id) DO NOTHING
             RETURNING id, username, is_admin`,
            [clerkUserId, email]
        );
        if (created.rows[0]) return created.rows[0];
    } catch (error) {
        if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
        const createdNoEmail = await db.query<TUserIdentityRow>(
            `INSERT INTO users (clerk_user_id) VALUES ($1)
             ON CONFLICT (clerk_user_id) DO NOTHING
             RETURNING id, username, is_admin`,
            [clerkUserId]
        );
        if (createdNoEmail.rows[0]) return createdNoEmail.rows[0];
    }

    // 5. Race (a concurrent first-sight created it) or soft-deleted-only row
    //    (→ null → caller returns 'unprovisioned').
    const reread = await db.query<TUserIdentityRow>(SELECT_BY_CLERK, [
        clerkUserId,
    ]);
    return reread.rows[0] ?? null;
}
