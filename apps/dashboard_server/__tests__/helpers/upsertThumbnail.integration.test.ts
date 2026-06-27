// Integration test for upsertThumbnail (the files.is_thumbnail writer).
//
// Requires a live Postgres (DATABASE_URL); skips wholesale when unreachable —
// same gate as posts.write.test.ts. Runs in its own file so it owns its pool
// lifecycle (each Jest file gets an isolated module registry / pool instance).
import { pool } from '../../src/database';
import { createPost } from '../../src/helpers/writePost';
import { upsertThumbnail } from '../../src/helpers/writeThumbnail';

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

const cfg = {
    cdnBase: 'https://assets.prettylog.com',
    bucket: 'blog.prettylog',
};
const urlFor = (n: string) =>
    `https://assets.prettylog.com/blog.prettylog/THUMBTEST/${n}.png`;

const tag = `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerk = `clerk_thumb_${tag}`;

async function liveThumbCount(postId: number): Promise<number> {
    const { rows } = await pool.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM files
          WHERE post_id = $1 AND is_thumbnail = true AND deleted_at IS NULL`,
        [postId]
    );
    return Number(rows[0].c);
}

describe('upsertThumbnail (integration)', () => {
    let reachable = false;
    let userId = 0;
    let postId = 0;

    beforeAll(async () => {
        reachable = await isDbReachable();
        if (!reachable) return;
        const u = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerk]
        );
        userId = Number(u.rows[0].id);
        const post = await createPost(pool, userId, {
            slug: `thumb-post-${tag}`,
            title: 'Thumb Post',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        postId = Number(post.id);
    });

    afterAll(async () => {
        if (reachable) {
            await pool.query('DELETE FROM files WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM posts WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM users WHERE clerk_user_id = $1', [
                clerk,
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!reachable)
            console.warn('upsertThumbnail.integration: DB unreachable — skipping');
        return reachable;
    };

    it('sets exactly one live thumbnail row with the stored absolute URL', async () => {
        if (!guard()) return;
        const client = await pool.connect();
        try {
            await upsertThumbnail(client, userId, postId, urlFor('a'), cfg);
        } finally {
            client.release();
        }
        expect(await liveThumbCount(postId)).toBe(1);
        const { rows } = await pool.query<{ stored_uri: string }>(
            `SELECT stored_uri FROM files
              WHERE post_id = $1 AND is_thumbnail = true AND deleted_at IS NULL`,
            [postId]
        );
        expect(rows[0].stored_uri).toBe(urlFor('a'));
    });

    it('replacing soft-deletes the prior row, leaving exactly one live', async () => {
        if (!guard()) return;
        const client = await pool.connect();
        try {
            await upsertThumbnail(client, userId, postId, urlFor('b'), cfg);
        } finally {
            client.release();
        }
        expect(await liveThumbCount(postId)).toBe(1);
        const { rows } = await pool.query<{ stored_uri: string }>(
            `SELECT stored_uri FROM files
              WHERE post_id = $1 AND is_thumbnail = true AND deleted_at IS NULL`,
            [postId]
        );
        expect(rows[0].stored_uri).toBe(urlFor('b'));
    });

    it('clearing (null) leaves zero live thumbnail rows', async () => {
        if (!guard()) return;
        const client = await pool.connect();
        try {
            await upsertThumbnail(client, userId, postId, null, cfg);
        } finally {
            client.release();
        }
        expect(await liveThumbCount(postId)).toBe(0);
    });

    it('rejects a foreign url (no CDN prefix)', async () => {
        if (!guard()) return;
        const client = await pool.connect();
        try {
            await expect(
                upsertThumbnail(
                    client,
                    userId,
                    postId,
                    'https://evil.example.com/x.png',
                    cfg
                )
            ).rejects.toThrow();
        } finally {
            client.release();
        }
    });
});
