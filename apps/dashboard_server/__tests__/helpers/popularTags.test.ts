// Phase H P0 — popular-tag read tests (H0.2 global, H0.3 scoped).
//
// The query lives in helpers/popularTags.ts; the routes are thin wrappers. This
// suite exercises the helpers directly with the live pool — the exact SQL the
// routes run — mirroring favorites/writePost integration tests.
//
// Requires a live Postgres (DATABASE_URL) WITH the post_tags relation present
// (migration 0001). Skips wholesale when unreachable/absent (never fakes a pass).
// Global-feed assertions filter results to THIS run's unique tag prefix so other
// rows in a shared DB cannot perturb counts/ordering.
import type { PoolClient } from 'pg';
import { pool } from '../../src/database';
import {
    clampTagLimit,
    listPopularTags,
    listUserPopularTags,
} from '../../src/helpers/popularTags';
import { createPost } from '../../src/helpers/writePost';
import { syncPostTags } from '../../src/helpers/writePostTags';
import type { TPostStatus } from '@repo/types';

describe('clampTagLimit (unit, no DB)', () => {
    it('defaults to 30 for missing/invalid/non-positive input', () => {
        expect(clampTagLimit(undefined)).toBe(30);
        expect(clampTagLimit('')).toBe(30);
        expect(clampTagLimit('abc')).toBe(30);
        expect(clampTagLimit('0')).toBe(30);
        expect(clampTagLimit('-5')).toBe(30);
    });

    it('passes a valid in-range value through', () => {
        expect(clampTagLimit('5')).toBe(5);
        expect(clampTagLimit('99')).toBe(99);
    });

    it('clamps to a max of 100', () => {
        expect(clampTagLimit('100')).toBe(100);
        expect(clampTagLimit('1000')).toBe(100);
    });
});

async function isTagsReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.post_tags') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const run = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const uA = `ua_${run}`;
const uB = `ub_${run}`;
// Unique tag namespace for this run (lowercase; tag_title is compared exactly).
const tA = `${run}_a`;
const tB = `${run}_b`;
const tZeta = `${run}_z`;
const tDraft = `${run}_draft`;
const tPriv = `${run}_priv`;
const tDel = `${run}_del`;
// Tag shared by TWO public revisions of ONE slug — must count as 1 (per-slug),
// not 2 (per-row), so the count matches the single card the tag feed renders.
const tRev = `${run}_rev`;

const onlyMine = (rows: { tag: string }[]) =>
    rows.filter((r) => r.tag.startsWith(run));

describe('popularTags (integration)', () => {
    let ready = false;
    let userA = 0;
    let userB = 0;
    const createdUsers: number[] = [];

    async function makePost(
        userId: number,
        slug: string,
        status: TPostStatus,
        tags: string[]
    ): Promise<string> {
        const post = await createPost(pool, userId, {
            slug: `${slug}_${run}`,
            title: slug,
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
        return post.id;
    }

    async function tombstoneLink(postId: string, tag: string): Promise<void> {
        await pool.query(
            `UPDATE post_tags SET deleted_at = now()
             WHERE post_id = $1 AND tag_title = $2`,
            [postId, tag]
        );
    }

    beforeAll(async () => {
        ready = await isTagsReady();
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

        await makePost(userA, 'pa1', 'public', [tA, tB]);
        await makePost(userA, 'pa2', 'public', [tA]);
        await makePost(userA, 'pa3', 'draft', [tDraft]);
        const pA4 = await makePost(userA, 'pa4', 'public', [tDel]);
        await tombstoneLink(pA4, tDel);
        const pA5 = await makePost(userA, 'pa5', 'public', [tA]);
        await tombstoneLink(pA5, tA); // soft-deleted tA link must NOT inflate tA
        await makePost(userB, 'pb1', 'public', [tB, tZeta]);
        await makePost(userB, 'pb2', 'private', [tPriv]);
        // Two PUBLIC revisions sharing ONE slug (`prev_${run}`) + tag tRev. The
        // feed dedupes them to one card, so the count must be 1, not 2.
        await makePost(userA, 'prev', 'public', [tRev]);
        await makePost(userA, 'prev', 'public', [tRev]);
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
                'popularTags.test: DB unreachable or post_tags absent — skipping'
            );
        return ready;
    };

    it('H0.2 global: counts public live links (per-slug), ordered count desc then tag asc', async () => {
        if (!guard()) return;
        const mine = onlyMine(await listPopularTags(pool, 100));
        expect(mine).toEqual([
            { tag: tA, count: 2 },
            { tag: tB, count: 2 },
            { tag: tRev, count: 1 }, // 2 revisions of one slug → counted once
            { tag: tZeta, count: 1 },
        ]);
    });

    it('H0.2 global: draft-only and private-only tags are absent', async () => {
        if (!guard()) return;
        const tags = onlyMine(await listPopularTags(pool, 100)).map(
            (r) => r.tag
        );
        expect(tags).not.toContain(tDraft);
        expect(tags).not.toContain(tPriv);
    });

    it('H0.2 global: a soft-deleted link does not inflate or appear', async () => {
        if (!guard()) return;
        const mine = onlyMine(await listPopularTags(pool, 100));
        const tagMap = new Map(mine.map((r) => [r.tag, r.count]));
        expect(tagMap.has(tDel)).toBe(false); // tDel had only a tombstoned link
        expect(tagMap.get(tA)).toBe(2); // pA5's tombstoned tA link not counted
    });

    it('H0.3 scoped: only the author public tags with counts, ordered', async () => {
        if (!guard()) return;
        const mine = onlyMine(await listUserPopularTags(pool, uA, 100));
        expect(mine).toEqual([
            { tag: tA, count: 2 },
            { tag: tB, count: 1 },
            { tag: tRev, count: 1 }, // 2 revisions of one slug → counted once
        ]);
    });

    it("H0.3 scoped: another user's tag, draft/private, and soft-deleted are absent", async () => {
        if (!guard()) return;
        const tags = onlyMine(await listUserPopularTags(pool, uA, 100)).map(
            (r) => r.tag
        );
        expect(tags).not.toContain(tZeta); // userB only
        expect(tags).not.toContain(tDraft);
        expect(tags).not.toContain(tPriv);
        expect(tags).not.toContain(tDel);
    });
});
