// Purpose: non-owner-scoped moderation operations against the posts table for
//          admins (list any author's posts / set status / soft-delete by id).
//          Contrast helpers/writePost.ts which binds every mutation to the
//          caller's user_id — these helpers act on ANY post by id and are gated
//          upstream solely by requireAdmin.
// Invariants:
//   * No user_id clause: an admin reaches across all authors.
//   * Admin delete is SOFT (deleted_at = now()), never a hard DELETE — the row
//     survives so ON DELETE CASCADE children are not orphaned/destroyed.
//   * listAllPosts applies NO status filter and NO per-slug dedupe: admins see
//     drafts, private posts, and every slug revision.
// Side effects: a single parameterized SQL statement per call.
import type { Pool, PoolClient } from 'pg';
import type { TAdminPostListItem, TPostStatus } from '@repo/types';

type TDb = Pool | PoolClient;

export type TAdminPostRow = Record<string, unknown> & { id: number };

// Keyset start for the first page: a value above any real BIGINT post id so the
// `p.id < $cursor` predicate selects the newest rows.
const MAX_CURSOR = '9223372036854775807';

type TListParams = { cursor?: number | null; limit: number };

type TListResult = {
    items: TAdminPostListItem[];
    nextCursor: number | null;
    hasMore: boolean;
};

type TRawListRow = {
    id: number;
    user_id: number;
    username: string | null;
    slug: string;
    title: string;
    status: TPostStatus;
    created_at: string;
    updated_at: string;
};

function toItem(r: TRawListRow): TAdminPostListItem {
    return {
        id: Number(r.id),
        userId: Number(r.user_id),
        username: r.username,
        slug: r.slug,
        title: r.title,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export async function listAllPosts(
    db: TDb,
    { cursor, limit }: TListParams
): Promise<TListResult> {
    const fetchLimit = limit + 1;
    const startCursor =
        cursor && cursor > 0 ? String(cursor) : MAX_CURSOR;

    const { rows } = await db.query<TRawListRow>(
        `SELECT p.id, p.user_id, u.username, p.slug, p.title, p.status,
                p.created_at, p.updated_at
         FROM posts p
         INNER JOIN users u ON p.user_id = u.id
         WHERE p.deleted_at IS NULL AND p.id < $1
         ORDER BY p.id DESC
         LIMIT $2`,
        [startCursor, fetchLimit]
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(toItem);
    const nextCursor =
        hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
}

export async function setPostStatus(
    db: TDb,
    postId: number,
    status: TPostStatus
): Promise<TAdminPostRow | null> {
    const { rows } = await db.query<TAdminPostRow>(
        `UPDATE posts SET status = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [postId, status]
    );
    return rows[0] ?? null;
}

export async function adminSoftDeletePost(
    db: TDb,
    postId: number
): Promise<number | null> {
    const { rows } = await db.query<{ id: number }>(
        `UPDATE posts SET deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [postId]
    );
    return rows[0] ? Number(rows[0].id) : null;
}
