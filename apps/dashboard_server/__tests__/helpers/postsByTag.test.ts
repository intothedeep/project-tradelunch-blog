// Phase H P0 — tag-feed read tests (H0.4 global, H0.5 scoped).
//
// The query lives in helpers/postsByTag.ts (slug-dedup BEFORE keyset); the routes
// are thin wrappers. This suite exercises the helper directly with the live pool.
//
// Requires a live Postgres (DATABASE_URL) WITH post_tags/post_likes/comments
// present (migrations 0001/0008/0009). Skips wholesale when unreachable/absent.
// The feed is filtered by a UNIQUE per-run tag, so a shared DB cannot perturb it.
import type { PoolClient } from 'pg';
import { pool } from '../../src/database';
import {
    normalizeCursor,
    clampFeedLimit,
    listPostsByTag,
} from '../../src/helpers/postsByTag';
import { createPost } from '../../src/helpers/writePost';
import { syncPostTags } from '../../src/helpers/writePostTags';
import type { TPostStatus } from '@repo/types';

describe('normalizeCursor / clampFeedLimit (unit, no DB)', () => {
    const MAX = '9223372036854775807';

    it('normalizeCursor resets missing/invalid/zero to the top sentinel', () => {
        expect(normalizeCursor(undefined)).toBe(MAX);
        expect(normalizeCursor('')).toBe(MAX);
        expect(normalizeCursor('abc')).toBe(MAX);
        expect(normalizeCursor('0')).toBe(MAX);
    });

    it('normalizeCursor preserves a numeric STRING verbatim (no Number cast)', () => {
        const big = '9007199254740993'; // 2^53 + 1 — would corrupt under Number()
        expect(normalizeCursor(big)).toBe(big);
        expect(normalizeCursor('123')).toBe('123');
    });

    it('clampFeedLimit defaults to 10 and clamps to 50', () => {
        expect(clampFeedLimit(undefined)).toBe(10);
        expect(clampFeedLimit('0')).toBe(10);
        expect(clampFeedLimit('abc')).toBe(10);
        expect(clampFeedLimit('5')).toBe(5);
        expect(clampFeedLimit('1000')).toBe(50);
    });
});

async function isFeedReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{
            a: string | null;
            b: string | null;
        }>(
            `SELECT to_regclass('public.post_tags') AS a,
                    to_regclass('public.post_likes') AS b`
        );
        return rows[0]?.a !== null && rows[0]?.b !== null;
    } catch {
        return false;
    }
}

const run = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const uA = `ua_${run}`;
const uB = `ub_${run}`;
const T = `${run}_feed`; // unique tag namespace (lowercase)
const dupSlug = `dup_${run}`;

describe('postsByTag feed (integration)', () => {
    let ready = false;
    let userA = 0;
    let userB = 0;
    const createdUsers: number[] = [];
    // ids in creation order; never Number()-ed (BIGINT strings).
    const ids: Record<string, string> = {};

    async function makePost(
        key: string,
        userId: number,
        slug: string,
        status: TPostStatus,
        tags: string[]
    ): Promise<string> {
        const post = await createPost(pool, userId, {
            slug,
            title: key,
            content: null,
            description: null,
            categoryId: null,
            status,
        });
        const client: PoolClient = await pool.connect();
        try {
            await syncPostTags(client, post.id, tags);
        } finally {
            client.release();
        }
        ids[key] = post.id;
        return post.id;
    }

    beforeAll(async () => {
        ready = await isFeedReady();
        if (!ready) return;

        const a = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id, username) VALUES ($1, $2) RETURNING id',
            [`clerk_${uA}`, uA]
        );
        const b = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id, username) VALUES ($1, $2) RETURNING id',
            [`clerk_${uB}`, uB]
        );
        userA = Number(a.rows[0].id);
        userB = Number(b.rows[0].id);
        createdUsers.push(userA, userB);

        // Creation order fixes both id order and (below) created_at order.
        await makePost('p1', userA, `s1_${run}`, 'public', [T]);
        await makePost('p2', userA, dupSlug, 'public', [T]); // older dup revision
        await makePost('p3', userB, `s3_${run}`, 'public', [T]);
        await makePost('p4', userA, dupSlug, 'public', [T]); // newer dup -> rn=1
        await makePost('p5', userB, `s5_${run}`, 'public', [T]);
        const p6 = await makePost('p6', userA, `s6_${run}`, 'public', [T]);
        await makePost('p7', userA, `s7_${run}`, 'draft', [T]); // excluded
        await makePost('p8', userB, `s8_${run}`, 'private', [T]); // excluded

        // Soft-delete p6's tag link → p6 drops out of the tag feed.
        await pool.query(
            `UPDATE post_tags SET deleted_at = now()
             WHERE post_id = $1 AND tag_title = $2`,
            [p6, T]
        );

        // Force a strictly-increasing created_at in creation order so the
        // slug-dedup (ORDER BY created_at DESC) deterministically keeps p4 over
        // p2 regardless of timestamp resolution. Epoch base is arbitrary.
        const order = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
        for (let i = 0; i < order.length; i++) {
            await pool.query(
                'UPDATE posts SET created_at = to_timestamp($2) WHERE id = $1',
                [ids[order[i]], 1700000000 + i]
            );
        }
    });

    afterAll(async () => {
        if (ready && createdUsers.length) {
            await pool.query(
                `DELETE FROM post_tags WHERE post_id IN
                   (SELECT id FROM posts WHERE user_id = ANY($1))`,
                [createdUsers]
            );
            await pool.query('DELETE FROM posts WHERE user_id = ANY($1)', [
                createdUsers,
            ]);
            await pool.query('DELETE FROM tags WHERE title LIKE $1', [
                `${run}%`,
            ]);
            await pool.query('DELETE FROM users WHERE id = ANY($1)', [
                createdUsers,
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!ready)
            console.warn(
                'postsByTag.test: DB unreachable or relations absent — skipping'
            );
        return ready;
    };

    it('H0.4 global: returns only public, live-tagged posts across authors', async () => {
        if (!guard()) return;
        const { posts } = await listPostsByTag(pool, {
            tag: T,
            cursor: normalizeCursor(undefined),
            limit: 50,
        });
        const got = posts.map((p) => p.id);
        // p5,p4,p3,p1 (desc by id); p2=older dup, p6=soft-deleted, p7=draft, p8=private.
        expect(got).toEqual([ids.p5, ids.p4, ids.p3, ids.p1]);
        expect(got).not.toContain(ids.p2);
        expect(got).not.toContain(ids.p6);
        expect(got).not.toContain(ids.p7);
        expect(got).not.toContain(ids.p8);
    });

    it('H0.4 global: nextCursor is the full-precision last-id STRING', async () => {
        if (!guard()) return;
        const page1 = await listPostsByTag(pool, {
            tag: T,
            cursor: normalizeCursor(undefined),
            limit: 2,
        });
        expect(page1.posts.map((p) => p.id)).toEqual([ids.p5, ids.p4]);
        expect(page1.hasMore).toBe(true);
        expect(typeof page1.nextCursor).toBe('string');
        // Exact id string passthrough — no Number()/parseInt round-trip.
        expect(page1.nextCursor).toBe(ids.p4);
        expect(page1.nextCursor).toBe(String(ids.p4));
    });

    it('H0.4 global: page 2 via nextCursor skips/dupes nothing; dup slug once', async () => {
        if (!guard()) return;
        const page1 = await listPostsByTag(pool, {
            tag: T,
            cursor: normalizeCursor(undefined),
            limit: 2,
        });
        const page2 = await listPostsByTag(pool, {
            tag: T,
            cursor: normalizeCursor(page1.nextCursor),
            limit: 2,
        });
        expect(page2.posts.map((p) => p.id)).toEqual([ids.p3, ids.p1]);
        expect(page2.hasMore).toBe(false);
        expect(page2.nextCursor).toBeNull();

        const union = [...page1.posts, ...page2.posts];
        // No id appears twice across the two pages.
        const allIds = union.map((p) => p.id);
        expect(new Set(allIds).size).toBe(allIds.length);
        // The dup slug (revisions p2 & p4 straddle the page-1 boundary at p4.id)
        // appears EXACTLY once, via its latest revision p4 — never p2.
        const dupRows = union.filter((p) => p.slug === dupSlug);
        expect(dupRows).toHaveLength(1);
        expect(dupRows[0].id).toBe(ids.p4);
        expect(allIds).not.toContain(ids.p2);
    });

    it('H0.5 scoped: only the author public posts, deduped; other author absent', async () => {
        if (!guard()) return;
        const { posts } = await listPostsByTag(pool, {
            tag: T,
            cursor: normalizeCursor(undefined),
            limit: 50,
            username: uA,
        });
        const got = posts.map((p) => p.id);
        // uA public live-tag rn=1 rows: dup(p4), s1(p1). p2=older dup excluded.
        expect(got).toEqual([ids.p4, ids.p1]);
        expect(got).not.toContain(ids.p3); // userB
        expect(got).not.toContain(ids.p5); // userB
        expect(got).not.toContain(ids.p2); // older dup revision
    });
});
