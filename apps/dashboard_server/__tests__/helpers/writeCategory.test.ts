// Category creation test (Phase G) for createCategory.
//
// AUTH SEAM: requireAuth verifies a real Clerk token (un-mintable in a unit
// test). The owner-scoping + placement (level/group) + (user_id,parent_id,title)
// conflict + soft-delete resurrection invariants all live in the createCategory
// helper, which the route calls with req.auth.userId as the authoritative owner.
// This suite exercises the helper directly with an INJECTED userId — the exact
// SQL the route runs.
//
// Requires a live Postgres (DATABASE_URL) with the categories table. Skips
// wholesale when the DB is unreachable OR the table is absent (never fakes a
// pass). All work runs in ONE transaction that is ROLLED BACK in afterAll, so
// the test leaves no rows behind and is independent of migration 0010.
import type { PoolClient } from 'pg';
import { pool } from '../../src/database';
import {
    createCategory,
    CategoryParentError,
} from '../../src/helpers/writeCategory';

async function isCategoriesReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.categories') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const tag = `wc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerk = `clerk_${tag}`;

describe('createCategory (integration)', () => {
    let ready = false;
    let client: PoolClient | null = null;
    let userId = 0;
    let rootId = '';
    let childId = '';

    beforeAll(async () => {
        ready = await isCategoriesReady();
        if (!ready) return;
        client = await pool.connect();
        await client.query('BEGIN');
        const u = await client.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerk]
        );
        userId = Number(u.rows[0].id);
    });

    afterAll(async () => {
        if (ready && client) {
            await client.query('ROLLBACK');
            client.release();
        }
        await pool.end();
    });

    const guard = () => {
        if (!ready)
            console.warn(
                'writeCategory.test: DB unreachable or categories table absent — skipping'
            );
        return ready;
    };

    it('creates a root: level 0, parentId null, group_id = self', async () => {
        if (!guard()) return;
        const result = await createCategory(client!, userId, {
            title: `inv_${tag}`,
            parentId: null,
        });
        expect(result.status).toBe('created');
        expect(result.node.level).toBe(0);
        expect(result.node.parentId).toBeNull();
        expect(result.node.groupId).toBe(result.node.id);
        rootId = result.node.id;
    });

    it('creates a child: level 1, parentId = root, group_id inherited', async () => {
        if (!guard()) return;
        const result = await createCategory(client!, userId, {
            title: `stk_${tag}`,
            parentId: rootId,
        });
        expect(result.status).toBe('created');
        expect(result.node.level).toBe(1);
        expect(result.node.parentId).toBe(rootId);
        expect(result.node.groupId).toBe(rootId);
        childId = result.node.id;
    });

    it('returns conflict with the existing node on an active duplicate', async () => {
        if (!guard()) return;
        const result = await createCategory(client!, userId, {
            title: `inv_${tag}`,
            parentId: null,
        });
        expect(result.status).toBe('conflict');
        expect(result.node.id).toBe(rootId);
    });

    it('resurrects a soft-deleted node in the same scope', async () => {
        if (!guard()) return;
        await client!.query(
            'UPDATE categories SET deleted_at = now() WHERE id = $1',
            [childId]
        );
        const result = await createCategory(client!, userId, {
            title: `stk_${tag}`,
            parentId: rootId,
        });
        expect(result.status).toBe('created');
        expect(result.node.id).toBe(childId);
        expect(result.node.level).toBe(1);

        const { rows } = await client!.query<{ deleted_at: string | null }>(
            'SELECT deleted_at FROM categories WHERE id = $1',
            [childId]
        );
        expect(rows[0].deleted_at).toBeNull();
    });

    it('throws CategoryParentError for a missing/unowned parent', async () => {
        if (!guard()) return;
        await expect(
            createCategory(client!, userId, {
                title: `orphan_${tag}`,
                parentId: '9223372036854775807',
            })
        ).rejects.toBeInstanceOf(CategoryParentError);
    });
});
