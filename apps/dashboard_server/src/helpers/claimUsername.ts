// Purpose: owner-scoped, one-shot username claim against the users table.
// Invariants:
//   * The claim is bound to the caller's user id ONLY (never a client-supplied
//     value) and only succeeds while username IS NULL (first claim wins).
//   * A Postgres unique-violation (23505) on the username index maps to a
//     "taken" conflict rather than a 500.
// Side effects: a single UPDATE against the live (non-deleted) users row.
import type { Pool, PoolClient } from 'pg';

export type TClaimUsernameResult =
    | { ok: true; username: string }
    | { ok: false; status: 409; reason: string };

type TPgError = { code?: string };

export async function claimUsername(
    db: Pool | PoolClient,
    userId: number,
    username: string
): Promise<TClaimUsernameResult> {
    try {
        const { rows } = await db.query<{ id: number; username: string }>(
            `UPDATE users SET username = $1, updated_at = now()
             WHERE id = $2 AND username IS NULL AND deleted_at IS NULL
             RETURNING id, username`,
            [username, userId]
        );

        const claimed = rows[0];
        if (!claimed) {
            return { ok: false, status: 409, reason: 'username already set' };
        }
        return { ok: true, username: claimed.username };
    } catch (error) {
        if ((error as TPgError)?.code === '23505') {
            return { ok: false, status: 409, reason: 'username taken' };
        }
        throw error;
    }
}
