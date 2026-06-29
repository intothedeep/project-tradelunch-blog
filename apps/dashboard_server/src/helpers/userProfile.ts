// Purpose: read a single author's public profile-card data (Phase H H5.5/F9).
// Invariants:
//   * postCount = COUNT(DISTINCT slug) over PUBLIC, non-deleted posts, so a
//     versioned slug counts ONCE (matches the slug-deduped public feed).
//   * Only non-deleted authors resolve; an unknown/deleted user → null.
//   * Viewer-agnostic (no auth personalization) — safe for a shared cache.
// Side effects: one parameterized SELECT per call (read-only).
import type { Pool } from 'pg';
import type { TUserProfile } from '@repo/types';

export async function getUserProfile(
    pool: Pool,
    username: string
): Promise<TUserProfile | null> {
    const { rows } = await pool.query<TUserProfile>(
        `SELECT u.username,
                u.display_name AS "displayName",
                u.avatar_url   AS "avatarUrl",
                (SELECT COUNT(DISTINCT p.slug)::int
                   FROM posts p
                  WHERE p.user_id = u.id
                    AND p.deleted_at IS NULL
                    AND p.status = 'public') AS "postCount"
           FROM users u
          WHERE u.username = $1
            AND u.deleted_at IS NULL`,
        [username]
    );
    return rows[0] ?? null;
}
