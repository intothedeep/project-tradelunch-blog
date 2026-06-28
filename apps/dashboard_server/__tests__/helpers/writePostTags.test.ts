// Tag-sync test (Phase G) for syncPostTags.
//
// The tag-set replace semantics live entirely in syncPostTags, which the post
// write route calls inside its transaction with the post's own id. This suite
// exercises the helper directly — the exact SQL the route runs — proving: a
// desired set is inserted; a replace soft-deletes removed links and adds new
// ones; a re-added tag RESURRECTS its existing link (no duplicate row); an empty
// array clears the live set (soft-delete only, rows retained).
//
// Requires a live Postgres (DATABASE_URL) with the post_tags table. Skips
// wholesale when unreachable OR the table is absent (never fakes a pass). All
// work runs in ONE transaction ROLLED BACK in afterAll — no rows persist, and
// global `tags` rows are suffixed per-run so they never collide with real data.
import type { PoolClient } from 'pg';
import { pool } from '../../src/database';
import { syncPostTags } from '../../src/helpers/writePostTags';
import { createPost } from '../../src/helpers/writePost';

async function isPostTagsReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.post_tags') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const tag = `wpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerk = `clerk_${tag}`;
const t1 = `react_${tag}`;
const t2 = `node_${tag}`;
const t3 = `ts_${tag}`;

async function liveTitles(client: PoolClient, postId: string): Promise<string[]> {
    const { rows } = await client.query<{ tag_title: string }>(
        `SELECT tag_title FROM post_tags
         WHERE post_id = $1 AND deleted_at IS NULL
         ORDER BY tag_title`,
        [postId]
    );
    return rows.map((r) => r.tag_title);
}

describe('syncPostTags (integration)', () => {
    let ready = false;
    let client: PoolClient | null = null;
    let userId = 0;
    let postId = '';

    beforeAll(async () => {
        ready = await isPostTagsReady();
        if (!ready) return;
        client = await pool.connect();
        await client.query('BEGIN');
        const u = await client.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerk]
        );
        userId = Number(u.rows[0].id);
        const post = await createPost(client, userId, {
            slug: `tag-target-${tag}`,
            title: 'Tag target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        postId = String(post.id);
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
                'writePostTags.test: DB unreachable or post_tags table absent — skipping'
            );
        return ready;
    };

    it('inserts the desired tag set', async () => {
        if (!guard()) return;
        await syncPostTags(client!, postId, [t1, t2]);
        expect(await liveTitles(client!, postId)).toEqual([t2, t1].sort());
    });

    it('replaces the set: soft-deletes removed, adds new', async () => {
        if (!guard()) return;
        await syncPostTags(client!, postId, [t1, t3]);
        expect(await liveTitles(client!, postId)).toEqual([t1, t3].sort());

        const { rows } = await client!.query<{ deleted_at: string | null }>(
            'SELECT deleted_at FROM post_tags WHERE post_id = $1 AND tag_title = $2',
            [postId, t2]
        );
        expect(rows[0].deleted_at).not.toBeNull();
    });

    it('resurrects a re-added link without creating a duplicate row', async () => {
        if (!guard()) return;
        await syncPostTags(client!, postId, [t2]);
        expect(await liveTitles(client!, postId)).toEqual([t2]);

        const { rows } = await client!.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM post_tags WHERE post_id = $1 AND tag_title = $2',
            [postId, t2]
        );
        expect(Number(rows[0].count)).toBe(1);
    });

    it('clears every live link on an empty array (soft-delete, rows retained)', async () => {
        if (!guard()) return;
        await syncPostTags(client!, postId, []);
        expect(await liveTitles(client!, postId)).toEqual([]);

        const { rows } = await client!.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM post_tags WHERE post_id = $1',
            [postId]
        );
        expect(Number(rows[0].count)).toBeGreaterThan(0);
    });
});
