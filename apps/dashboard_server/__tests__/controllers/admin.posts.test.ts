// Admin moderation security test (MERGE GATE) for Phase D4.
//
// AUTH SEAM: requireAdmin = [requireAuth, assertAdmin]. requireAuth verifies a
// real Clerk token (un-mintable in a unit test), so we exercise assertAdmin
// directly (the second handler in the array) to prove the 403 gate, and we
// exercise the adminPosts helpers directly with INJECTED ids — the exact SQL the
// routes run — to prove admin acts on ANY author's post (non-owner-scoped) and
// that delete is SOFT (row survives with deleted_at set).
//
// Requires a live Postgres (DATABASE_URL); skips wholesale when unreachable.
import type { RequestHandler } from 'express';
import { pool } from '../../src/database';
import { requireAdmin } from '../../src/middlewares/requireAdmin';
import {
    setPostStatus,
    adminSoftDeletePost,
} from '../../src/helpers/adminPosts';
import { createPost } from '../../src/helpers/writePost';

const assertAdmin = requireAdmin[1] as RequestHandler;

function mockRes() {
    const res: { statusCode: number; body: unknown } = {
        statusCode: 200,
        body: undefined,
    };
    return {
        status(code: number) {
            res.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            res.body = payload;
            return this;
        },
        _res: res,
    };
}

describe('assertAdmin gate (unit)', () => {
    it('rejects a non-admin identity with 403 and does not call next', () => {
        const res = mockRes();
        const next = jest.fn();
        assertAdmin(
            { auth: { userId: 1, username: null, isAdmin: false } } as never,
            res as never,
            next as never
        );
        expect(res._res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('passes an admin identity through to next', () => {
        const res = mockRes();
        const next = jest.fn();
        assertAdmin(
            { auth: { userId: 1, username: null, isAdmin: true } } as never,
            res as never,
            next as never
        );
        expect(next).toHaveBeenCalledTimes(1);
    });
});

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

const tag = `ap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkB = `clerk_b_${tag}`;

describe('adminPosts non-owner-scoping (integration)', () => {
    let reachable = false;
    let userB = 0;
    let postOfB = 0;

    beforeAll(async () => {
        reachable = await isDbReachable();
        if (!reachable) return;
        const b = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerkB]
        );
        userB = Number(b.rows[0].id);

        const post = await createPost(pool, userB, {
            slug: `owned-by-b-${tag}`,
            title: 'Owned by B',
            content: 'original',
            description: 'orig desc',
            categoryId: null,
            status: 'public',
        });
        postOfB = Number(post.id);
    });

    afterAll(async () => {
        if (reachable) {
            await pool.query('DELETE FROM posts WHERE user_id = $1', [userB]);
            await pool.query('DELETE FROM users WHERE clerk_user_id = $1', [
                clerkB,
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!reachable)
            console.warn('admin.posts.test: DB unreachable — skipping');
        return reachable;
    };

    it('admin setPostStatus changes another user post by id (non-owner-scoped)', async () => {
        if (!guard()) return;
        const row = await setPostStatus(pool, postOfB, 'private');
        expect(row).not.toBeNull();
        expect(row!.status).toBe('private');
    });

    it('admin adminSoftDeletePost soft-deletes another user post; row survives', async () => {
        if (!guard()) return;
        const deletedId = await adminSoftDeletePost(pool, postOfB);
        expect(deletedId).toBe(postOfB);

        // Soft delete: the row still exists, only deleted_at is set.
        const { rows } = await pool.query<{ deleted_at: string | null }>(
            'SELECT deleted_at FROM posts WHERE id = $1',
            [postOfB]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].deleted_at).not.toBeNull();
    });
});
