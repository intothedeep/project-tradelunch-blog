// Purpose: owner-scoped write operations against the posts table (create /
//          update / soft-delete). The author is ALWAYS the injected userId —
//          never a client-supplied value — which is also the auth test seam:
//          tests exercise these helpers directly with a known userId instead of
//          a real Clerk token.
// Invariants:
//   * Every mutation is bound to user_id = $caller AND deleted_at IS NULL, so a
//     non-owner can never read, update, or delete another author's row.
//   * updatePost uses COALESCE($n, column) for most fields (change or leave
//     untouched), EXCEPT category_id, which is TRI-STATE: a present key in the
//     patch sets it (including to null = clear); an absent key leaves it. The
//     validator only spreads categoryId when the request supplied the key, so
//     ('categoryId' in patch) is the authoritative "key present" signal.
//   * category_id is a BIGINT column; the id is bound as a STRING (never Number()-ed).
// Side effects: a single parameterized SQL statement per call.
import type { Pool, PoolClient } from 'pg';
import type { TPostInput, TPostStatus } from '@repo/types';

type TDb = Pool | PoolClient;

// id is a Postgres BIGINT; node-pg returns it as a STRING to avoid the
// precision loss of JS numbers (>2^53). Never coerce it to Number.
export type TPostRow = Record<string, unknown> & { id: string };

export type TCreatePostInput = {
    slug: string;
    title: string;
    content: string | null;
    description: string | null;
    // Leaf category id as a STRING (BIGINT-safe) or null. Bound verbatim to the
    // BIGINT column; never Number()-ed.
    categoryId: string | null;
    status: TPostStatus;
};

export async function createPost(
    db: TDb,
    userId: number,
    input: TCreatePostInput
): Promise<TPostRow> {
    const { rows } = await db.query<TPostRow>(
        `INSERT INTO posts (user_id, slug, title, content, description, category_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            userId,
            input.slug,
            input.title,
            input.content,
            input.description,
            input.categoryId,
            input.status,
        ]
    );
    return rows[0];
}

// Owner-or-admin scoping: a caller may mutate a post they own, OR any post when
// isAdmin is true. Mirrors the comments edit/delete policy and the OwnerEditButton
// affordance (which already shows for admins). Defaults to owner-only.
export async function updatePost(
    db: TDb,
    userId: number,
    postId: string,
    patch: TPostInput,
    isAdmin = false
): Promise<TPostRow | null> {
    // category_id is tri-state: only overwrite it when the request supplied the
    // key. $10 = "key present" → set to $6 (which may be null = clear); else keep.
    const categoryIdProvided = 'categoryId' in patch;
    const { rows } = await db.query<TPostRow>(
        `UPDATE posts SET
            title       = COALESCE($3, title),
            content     = COALESCE($4, content),
            description = COALESCE($5, description),
            category_id = CASE WHEN $10 THEN $6 ELSE category_id END,
            status      = COALESCE($7, status),
            slug        = COALESCE($8, slug),
            updated_at  = now()
         WHERE id = $1 AND (user_id = $2 OR $9) AND deleted_at IS NULL
         RETURNING *`,
        [
            postId,
            userId,
            patch.title ?? null,
            patch.content ?? null,
            patch.description ?? null,
            patch.categoryId ?? null,
            patch.status ?? null,
            patch.slug ?? null,
            isAdmin,
            categoryIdProvided,
        ]
    );
    return rows[0] ?? null;
}

export async function softDeletePost(
    db: TDb,
    userId: number,
    postId: string,
    isAdmin = false
): Promise<string | null> {
    const { rows } = await db.query<{ id: string }>(
        `UPDATE posts SET deleted_at = now()
         WHERE id = $1 AND (user_id = $2 OR $3) AND deleted_at IS NULL
         RETURNING id`,
        [postId, userId, isAdmin]
    );
    return rows[0] ? rows[0].id : null;
}
