// Purpose: read popular tags as (tag, count) pairs — globally and per-user.
//          count is COUNT(DISTINCT slug) of LIVE post_tags links on PUBLIC posts.
// Invariants:
//   * Every query filters pt.deleted_at IS NULL (links are SOFT-deleted — see
//     helpers/writePostTags.ts) so tombstoned links never inflate a count.
//   * Count is per-SLUG, not per-row: the feed (helpers/postsByTag.ts) dedupes
//     multiple public revisions of a slug to one card, so the count must too —
//     otherwise count(N revisions) > the 1 card the tag page shows.
//   * Only public, non-deleted posts of non-deleted authors are counted.
//   * Viewer-agnostic: no auth personalization (safe for a shared cache).
// Side effects: one parameterized SELECT per call (read-only).
import type { Pool } from 'pg';
import type { TPopularTag } from '@repo/types';

const DEFAULT_TAG_LIMIT = 30;
const MAX_TAG_LIMIT = 100;

// Clamp a raw `limit` query value to [1, MAX] with a default. The limit is a
// small COUNT (not a BIGINT id), so parseInt is safe here.
export function clampTagLimit(
    raw: unknown,
    def: number = DEFAULT_TAG_LIMIT,
    max: number = MAX_TAG_LIMIT
): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
}

// Global popular tags across ALL authors' public posts.
export async function listPopularTags(
    pool: Pool,
    limit: number
): Promise<TPopularTag[]> {
    const { rows } = await pool.query<TPopularTag>(
        `SELECT pt.tag_title AS tag, COUNT(DISTINCT p.slug)::int AS count
         FROM post_tags pt
         JOIN posts p ON p.id = pt.post_id
         JOIN users u ON p.user_id = u.id
            AND u.deleted_at IS NULL
         WHERE pt.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND p.status = 'public'
         GROUP BY pt.tag_title
         ORDER BY count DESC, pt.tag_title ASC
         LIMIT $1`,
        [limit]
    );
    return rows;
}

// Popular tags scoped to a single author's public posts.
export async function listUserPopularTags(
    pool: Pool,
    username: string,
    limit: number
): Promise<TPopularTag[]> {
    const { rows } = await pool.query<TPopularTag>(
        `SELECT pt.tag_title AS tag, COUNT(DISTINCT p.slug)::int AS count
         FROM post_tags pt
         JOIN posts p ON p.id = pt.post_id
         JOIN users u ON p.user_id = u.id
            AND u.username = $1
            AND u.deleted_at IS NULL
         WHERE pt.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND p.status = 'public'
         GROUP BY pt.tag_title
         ORDER BY count DESC, pt.tag_title ASC
         LIMIT $2`,
        [username, limit]
    );
    return rows;
}
