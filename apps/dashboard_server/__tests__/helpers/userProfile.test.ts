// Phase H H5.5/F9 — author profile-card source test.
//
// The SQL lives in helpers/userProfile.ts; the route is a thin wrapper. This
// suite exercises the helper directly with the live pool — mirroring the
// popularTags/favorites integration tests. Skips wholesale when Postgres is
// unreachable (never fakes a pass).
//
// Key assertion: postCount = COUNT(DISTINCT slug) over PUBLIC, non-deleted posts,
// so a versioned slug (two public rows, same slug) counts ONCE, and drafts /
// private / deleted posts are excluded.
import { pool } from '../../src/database';
import { getUserProfile } from '../../src/helpers/userProfile';
import { createPost } from '../../src/helpers/writePost';
import type { TPostStatus } from '@repo/types';

async function isUsersReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.users') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const run = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const uName = `u_${run}`;

describe('getUserProfile (integration)', () => {
    let ready = false;
    let userId = 0;
    const createdUsers: number[] = [];

    async function makePost(
        slug: string,
        status: TPostStatus
    ): Promise<string> {
        const post = await createPost(pool, userId, {
            slug,
            title: slug,
            content: null,
            description: null,
            categoryId: null,
            status,
        });
        return post.id;
    }

    beforeAll(async () => {
        ready = await isUsersReady();
        if (!ready) return;

        const u = await pool.query<{ id: number }>(
            `INSERT INTO users (clerk_user_id, username, display_name, avatar_url)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
                `clerk_${uName}`,
                uName,
                'Display Name',
                'https://cdn.example/a.webp',
            ]
        );
        userId = Number(u.rows[0].id);
        createdUsers.push(userId);

        // Two PUBLIC rows sharing one slug (a versioned post) → counts ONCE.
        await makePost(`shared_${run}`, 'public');
        await makePost(`shared_${run}`, 'public');
        // A second distinct public slug → +1.
        await makePost(`solo_${run}`, 'public');
        // Excluded: draft + private.
        await makePost(`draft_${run}`, 'draft');
        await makePost(`priv_${run}`, 'private');
    });

    afterAll(async () => {
        if (ready && createdUsers.length) {
            await pool.query('DELETE FROM posts WHERE user_id = ANY($1)', [
                createdUsers,
            ]);
            await pool.query('DELETE FROM users WHERE id = ANY($1)', [
                createdUsers,
            ]);
        }
    });

    it('returns displayName/avatarUrl and a DISTINCT-public-slug postCount', async () => {
        if (!ready) return;
        const profile = await getUserProfile(pool, uName);
        expect(profile).not.toBeNull();
        expect(profile!.username).toBe(uName);
        expect(profile!.displayName).toBe('Display Name');
        expect(profile!.avatarUrl).toBe('https://cdn.example/a.webp');
        // shared (counts once) + solo = 2; draft/private excluded.
        expect(profile!.postCount).toBe(2);
    });

    it('returns null for an unknown username', async () => {
        if (!ready) return;
        const profile = await getUserProfile(pool, `nope_${run}`);
        expect(profile).toBeNull();
    });
});
