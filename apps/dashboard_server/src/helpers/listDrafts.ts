// Purpose: owner-scoped listing of a user's draft and private posts, mapped to TDraftSummary.
// Invariants: bound to user_id = $caller AND status IN ('draft','private') AND deleted_at IS
//             NULL; newest-updated first. The caller id is the auth seam (tests
//             inject it directly). DB rows are snake_case; output is camelCase.
// Side effects: a single parameterized SELECT.
import type { Pool, PoolClient } from 'pg';
import type { TDraftSummary, TPostStatus } from '@repo/types';

type TDb = Pool | PoolClient;

type TDraftRow = {
    id: string; // BIGINT — pg returns it as a string; never Number() it.
    slug: string;
    title: string;
    description: string | null;
    status: TPostStatus;
    category_id: string | null; // BIGINT — pg returns a string; never Number() it.
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
         WHERE user_id = $1 AND status IN ('draft','private') AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT $2`,
        [userId, limit]
    );

    return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        status: r.status,
        categoryId: r.category_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}
