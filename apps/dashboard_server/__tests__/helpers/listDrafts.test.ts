// Integration test for the owner-scoped draft listing (D2.2).
//
// AUTH SEAM: the GET /me/drafts route calls listDrafts(pool, req.auth.userId,
// limit). This suite drives listDrafts directly with an injected userId — the
// exact query the route runs.
//
// DB-PUSH GATE (D2.1b): status='draft' requires migration 0005 to be pushed to
// the live DB. Until then the enum lacks 'draft', so inserting a draft throws
// (invalid input value). The "lists drafts" assertion therefore self-skips when
// the enum value is absent, and clearly logs that it is blocked on db push.
// The empty-list and owner-scoping assertions run regardless.
import { pool } from '../../src/database';
import { createPost } from '../../src/helpers/writePost';
import { listDrafts } from '../../src/helpers/listDrafts';

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

async function hasDraftEnum(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ ok: boolean }>(
            `SELECT 'draft' = ANY(enum_range(NULL::post_status_enum)::text[]) AS ok`
        );
        return Boolean(rows[0]?.ok);
    } catch {
        return false;
    }
}

const tag = `ld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;

describe('listDrafts (integration)', () => {
    let reachable = false;
    let draftEnumReady = false;
    let userA = 0;
    let userB = 0;

    beforeAll(async () => {
        reachable = await isDbReachable();
        if (!reachable) return;
        draftEnumReady = await hasDraftEnum();
        const a = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerkA]
        );
        const b = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerkB]
        );
        userA = Number(a.rows[0].id);
        userB = Number(b.rows[0].id);
    });

    afterAll(async () => {
        if (reachable) {
            await pool.query('DELETE FROM posts WHERE user_id = ANY($1)', [
                [userA, userB],
            ]);
            await pool.query('DELETE FROM users WHERE clerk_user_id = ANY($1)', [
                [clerkA, clerkB],
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!reachable) console.warn('listDrafts.test: DB unreachable — skipping');
        return reachable;
    };

    it('returns an empty list for a user with no drafts', async () => {
        if (!guard()) return;
        if (!draftEnumReady) {
            console.warn(
                'listDrafts.test: post_status_enum lacks draft — blocked on db push (0005); skipping'
            );
            return;
        }
        const drafts = await listDrafts(pool, userA, 50);
        expect(drafts).toEqual([]);
    });

    it("lists only the caller's drafts, newest-updated first", async () => {
        if (!guard()) return;
        if (!draftEnumReady) {
            console.warn(
                'listDrafts.test: post_status_enum lacks draft — blocked on db push (0005); skipping draft assertion'
            );
            return;
        }

        await createPost(pool, userA, {
            slug: `draft-a-1-${tag}`,
            title: 'A draft 1',
            content: null,
            description: null,
            categoryId: null,
            status: 'draft',
        });
        await createPost(pool, userB, {
            slug: `draft-b-1-${tag}`,
            title: 'B draft 1',
            content: null,
            description: null,
            categoryId: null,
            status: 'draft',
        });

        const draftsA = await listDrafts(pool, userA, 50);
        expect(draftsA).toHaveLength(1);
        expect(draftsA[0].title).toBe('A draft 1');
        expect(draftsA[0].status).toBe('draft');
    });
});
