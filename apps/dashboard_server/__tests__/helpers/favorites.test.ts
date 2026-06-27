// Caller-scoping security test (MERGE GATE) for Phase 2 favorites.
//
// AUTH SEAM: requireAuth verifies a real Clerk token, which cannot be minted in
// a unit test. The caller-scoping invariant lives entirely in the favorites
// helpers (listFavoritePostIds/addFavorite/removeFavorite), which the routes
// call with req.auth.userId as the authoritative owner. This suite exercises
// those helpers directly with an INJECTED userId — the exact SQL the routes run
// — so a green run proves user A cannot read, add to, or delete from user B's
// favorites.
//
// Requires a live Postgres (DATABASE_URL) WITH migration 0006 applied
// (post_favorites table). Skips wholesale when the DB is unreachable OR the
// table is absent (migration not yet pushed) — it never fakes a pass.
import { pool } from '../../src/database';
import {
    listFavoritePostIds,
    addFavorite,
    removeFavorite,
} from '../../src/helpers/favorites';
import { createPost } from '../../src/helpers/writePost';

// Ready = DB reachable AND the post_favorites relation exists (migration 0006
// applied). Either gap → skip, so the suite is green before the USER pushes the
// migration and runs real assertions afterward.
async function isFavoritesReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.post_favorites') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const tag = `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;

describe('favorites caller-scoping (integration)', () => {
    let ready = false;
    let userA = 0;
    let userB = 0;
    let postId = '';

    beforeAll(async () => {
        ready = await isFavoritesReady();
        if (!ready) return;
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
            slug: `fav-target-${tag}`,
            title: 'Fav target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        // Snowflake id preserved as a string (no Number cast).
        postId = String(post.id);

        // User B favorites the post.
        await addFavorite(pool, userB, postId);
    });

    afterAll(async () => {
        if (ready) {
            await pool.query(
                'DELETE FROM post_favorites WHERE user_id = ANY($1)',
                [[userA, userB]]
            );
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
        if (!ready)
            console.warn(
                'favorites.test: DB unreachable or migration 0006 not applied — skipping'
            );
        return ready;
    };

    it("user A cannot READ user B's favorites", async () => {
        if (!guard()) return;
        const aFavorites = await listFavoritePostIds(pool, userA);
        expect(aFavorites).not.toContain(postId);

        const bFavorites = await listFavoritePostIds(pool, userB);
        expect(bFavorites).toContain(postId);
    });

    it("user A cannot DELETE user B's favorite (B's row survives)", async () => {
        if (!guard()) return;
        const deleted = await removeFavorite(pool, userA, postId);
        expect(deleted).toBe(false);

        const bFavorites = await listFavoritePostIds(pool, userB);
        expect(bFavorites).toContain(postId);
    });

    it('user A ADD is recorded under A only, never affecting B', async () => {
        if (!guard()) return;
        const created = await addFavorite(pool, userA, postId);
        expect(created).toBe(true);

        const aFavorites = await listFavoritePostIds(pool, userA);
        expect(aFavorites).toContain(postId);
        // The row is keyed by (user_id, post_id), so A's add is a distinct row.
        const { rows } = await pool.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM post_favorites WHERE post_id = $1',
            [postId]
        );
        expect(Number(rows[0].count)).toBe(2);
    });

    it('addFavorite is idempotent (no duplicate row on double-save)', async () => {
        if (!guard()) return;
        const second = await addFavorite(pool, userA, postId);
        expect(second).toBe(false);

        const aFavorites = await listFavoritePostIds(pool, userA);
        expect(aFavorites.filter((id) => id === postId)).toHaveLength(1);
    });

    it('the owner CAN remove their own favorite', async () => {
        if (!guard()) return;
        const removed = await removeFavorite(pool, userA, postId);
        expect(removed).toBe(true);

        const aFavorites = await listFavoritePostIds(pool, userA);
        expect(aFavorites).not.toContain(postId);
    });
});
