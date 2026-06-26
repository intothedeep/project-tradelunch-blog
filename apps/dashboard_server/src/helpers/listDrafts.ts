// Purpose: owner-scoped listing of a user's draft posts, mapped to TDraftSummary.
// Invariants: bound to user_id = $caller AND status = 'draft' AND deleted_at IS
//             NULL; newest-updated first. The caller id is the auth seam (tests
//             inject it directly). DB rows are snake_case; output is camelCase.
// Side effects: a single parameterized SELECT.
import type { Pool, PoolClient } from 'pg';
import type { TDraftSummary, TPostStatus } from '@repo/types';

type TDb = Pool | PoolClient;

type TDraftRow = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: TPostStatus;
    category_id: number | null;
    created_at: string;
    updated_at: string;
};

export async function listDrafts(
    db: TDb,
    userId: number,
    limit: number
): Promise<TDraftSummary[]> {
    const { rows } = await db.query<TDraftRow>(
        `SELECT id, slug, title, description, status, category_id, created_at, updated_at
         FROM posts
         WHERE user_id = $1 AND status = 'draft' AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT $2`,
        [userId, limit]
    );

    return rows.map((r) => ({
        id: Number(r.id),
        slug: r.slug,
        title: r.title,
        description: r.description,
        status: r.status,
        categoryId: r.category_id === null ? null : Number(r.category_id),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}
