// Purpose: owner-scoped creation of a single category node inside the CALLER's
//          transaction. Conflict scope is (user_id, parent_id, title) — same
//          title under DIFFERENT parents is allowed (see migration 0010).
// Invariants:
//   * userId is ALWAYS the injected caller (owner-scoped); never client-supplied.
//   * title is pre-normalized (lowercase, trimmed) by validateCategoryInput.
//   * All ids are STRINGS end-to-end (BIGINT; never Number()-ed).
//   * Resolution order for (user, parent, title):
//       - an ACTIVE row exists           → return { status:'conflict', node }
//       - a SOFT-DELETED row exists       → resurrect + reparent → 'created'
//       - none                            → insert → 'created'
//   * Root (parentId null): level 0, group_id = self. Child: parent must be
//     owned + live; level = parent.level + 1, group_id inherited. A missing/
//     unowned parent yields zero rows → CategoryParentError (maps to 400).
// Side effects: parameterized SQL within the caller's transaction.
import type { PoolClient } from 'pg';
import type { TCategoryNode } from '@repo/types';

// Thrown when a child's parent does not exist / is not owned by the caller / is
// soft-deleted. The controller maps this to HTTP 400.
export class CategoryParentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CategoryParentError';
    }
}

export type TCreateCategoryResult = {
    status: 'created' | 'conflict';
    node: TCategoryNode;
};

// Raw category row (snake_case, BIGINT ids serialized as strings by node-pg).
type TCategoryRow = {
    id: string;
    parent_id: string | null;
    group_id: string | null;
    title: string;
    level: number;
    priority: number;
};

function toNode(row: TCategoryRow): TCategoryNode {
    return {
        id: String(row.id),
        parentId: row.parent_id === null ? null : String(row.parent_id),
        groupId: row.group_id === null ? null : String(row.group_id),
        title: row.title,
        level: row.level,
        priority: row.priority,
    };
}

const NODE_COLS = 'id, parent_id, group_id, title, level, priority';

// Look up an existing row (active or soft-deleted) for the conflict scope.
async function findExisting(
    client: PoolClient,
    userId: number,
    parentId: string | null,
    title: string
): Promise<(TCategoryRow & { deleted_at: string | null }) | null> {
    const { rows } = await client.query<TCategoryRow & { deleted_at: string | null }>(
        `SELECT ${NODE_COLS}, deleted_at
         FROM categories
         WHERE user_id = $1
           AND title = $2
           AND parent_id IS NOT DISTINCT FROM $3`,
        [userId, title, parentId]
    );
    return rows[0] ?? null;
}

export async function createCategory(
    client: PoolClient,
    userId: number,
    input: { title: string; parentId: string | null }
): Promise<TCreateCategoryResult> {
    const { title, parentId } = input;

    const existing = await findExisting(client, userId, parentId, title);
    if (existing && existing.deleted_at === null) {
        return { status: 'conflict', node: toNode(existing) };
    }
    if (existing) {
        // Soft-deleted row in the same scope → resurrect + recompute placement.
        const node = await resurrectCategory(client, userId, existing.id, parentId);
        return { status: 'created', node };
    }

    const node = await insertCategory(client, userId, parentId, title);
    return { status: 'created', node };
}

// Insert a brand-new node. Root → level 0 then group_id = self (two statements:
// the IDENTITY id is unknown until the INSERT returns; a sibling-CTE UPDATE
// could not see the just-inserted row). Child → single INSERT…SELECT from the
// owned, live parent (zero rows = bad parent).
async function insertCategory(
    client: PoolClient,
    userId: number,
    parentId: string | null,
    title: string
): Promise<TCategoryNode> {
    if (parentId === null) {
        const inserted = await client.query<{ id: string }>(
            `INSERT INTO categories (user_id, title, parent_id, level)
             VALUES ($1, $2, NULL, 0)
             RETURNING id`,
            [userId, title]
        );
        const newId = inserted.rows[0]!.id;
        const { rows } = await client.query<TCategoryRow>(
            `UPDATE categories
             SET group_id = id, updated_at = now()
             WHERE id = $1
             RETURNING ${NODE_COLS}`,
            [newId]
        );
        return toNode(rows[0]!);
    }

    const { rows } = await client.query<TCategoryRow>(
        `INSERT INTO categories (user_id, title, parent_id, level, group_id)
         SELECT $1, $2, p.id, p.level + 1, p.group_id
         FROM categories p
         WHERE p.id = $3 AND p.user_id = $1 AND p.deleted_at IS NULL
         RETURNING ${NODE_COLS}`,
        [userId, title, parentId]
    );
    if (rows.length === 0) {
        throw new CategoryParentError('parent category not found');
    }
    return toNode(rows[0]!);
}

// Resurrect a soft-deleted node and recompute its placement under parentId.
async function resurrectCategory(
    client: PoolClient,
    userId: number,
    categoryId: string,
    parentId: string | null
): Promise<TCategoryNode> {
    if (parentId === null) {
        const { rows } = await client.query<TCategoryRow>(
            `UPDATE categories
             SET deleted_at = NULL, parent_id = NULL, level = 0,
                 group_id = id, updated_at = now()
             WHERE id = $1 AND user_id = $2
             RETURNING ${NODE_COLS}`,
            [categoryId, userId]
        );
        return toNode(rows[0]!);
    }

    const { rows } = await client.query<TCategoryRow>(
        `UPDATE categories c
         SET deleted_at = NULL, parent_id = p.id, level = p.level + 1,
             group_id = p.group_id, updated_at = now()
         FROM categories p
         WHERE c.id = $1 AND c.user_id = $2
           AND p.id = $3 AND p.user_id = $2 AND p.deleted_at IS NULL
         RETURNING c.id, c.parent_id, c.group_id, c.title, c.level, c.priority`,
        [categoryId, userId, parentId]
    );
    if (rows.length === 0) {
        throw new CategoryParentError('parent category not found');
    }
    return toNode(rows[0]!);
}
