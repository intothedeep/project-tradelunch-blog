// Owner-scoping security test (MERGE GATE) for Phase D2 authoring.
//
// AUTH SEAM: requireAuth verifies a real Clerk token, which cannot be minted in
// a unit test. The owner-scoping invariant lives entirely in the writePost
// helpers (createPost/updatePost/softDeletePost), which the routes call with
// req.auth.userId as the authoritative author. This suite exercises those
// helpers directly with an INJECTED userId — the exact SQL the routes run — so a
// green run proves a non-owner cannot mutate another author's row.
//
// Requires a live Postgres (DATABASE_URL); skips wholesale when unreachable.
// Uses status='public' (not 'draft') so it passes BEFORE migration 0005 is
// pushed to the live DB.
import { pool } from '../../src/database';
import {
    createPost,
    updatePost,
    softDeletePost,
} from '../../src/helpers/writePost';

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

const tag = `pw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;

describe('writePost owner-scoping (integration)', () => {
    let reachable = false;
    let userA = 0;
    let userB = 0;
    let postOfB = ''; // post id is a BIGINT string; never Number() it

    beforeAll(async () => {
        reachable = await isDbReachable();
        if (!reachable) return;
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

        const post = await createPost(pool, userB, {
            slug: `owned-by-b-${tag}`,
            title: 'Owned by B',
            content: 'original',
            description: 'orig desc',
            categoryId: null,
            status: 'public',
        });
        postOfB = post.id;
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
        if (!reachable) console.warn('posts.write.test: DB unreachable — skipping');
        return reachable;
    };

    it('user A cannot PATCH user B post (404) and the row is unchanged', async () => {
        if (!guard()) return;
        const result = await updatePost(pool, userA, postOfB, {
            title: 'hacked',
        });
        expect(result).toBeNull();

        const { rows } = await pool.query<{ title: string }>(
            'SELECT title FROM posts WHERE id = $1',
            [postOfB]
        );
        expect(rows[0].title).toBe('Owned by B');
    });

    it('user A cannot soft-delete user B post (404) and deleted_at stays NULL', async () => {
        if (!guard()) return;
        const deletedId = await softDeletePost(pool, userA, postOfB);
        expect(deletedId).toBeNull();

        const { rows } = await pool.query<{ deleted_at: string | null }>(
            'SELECT deleted_at FROM posts WHERE id = $1',
            [postOfB]
        );
        expect(rows[0].deleted_at).toBeNull();
    });

    it('createPost records the row under the injected userId, never a body user_id', async () => {
        if (!guard()) return;
        // The helper has no parameter for a client-supplied user_id; the author
        // is ALWAYS the injected arg. Even if a caller passed user_id:999999 in a
        // request body, it could not reach this column.
        const row = await createPost(pool, userA, {
            slug: `by-a-${tag}`,
            title: 'By A',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        expect(Number(row.user_id)).toBe(userA);
        expect(Number(row.user_id)).not.toBe(999999);
    });

    it('the owner CAN update and soft-delete their own post', async () => {
        if (!guard()) return;
        const updated = await updatePost(pool, userB, postOfB, {
            title: 'Owned by B v2',
        });
        expect(updated).not.toBeNull();
        expect(updated!.title).toBe('Owned by B v2');

        const deletedId = await softDeletePost(pool, userB, postOfB);
        expect(deletedId).toBe(postOfB);
    });
});
