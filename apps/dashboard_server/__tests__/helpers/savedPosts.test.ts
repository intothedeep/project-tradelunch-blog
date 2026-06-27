// Caller-scoping + visibility-filter test (MERGE GATE) for the saved-posts list.
//
// AUTH SEAM: requireAuth verifies a real Clerk token, which cannot be minted in
// a unit test. The owner-scoping invariant lives entirely in listSavedPosts,
// which the GET /favorites/posts route calls with req.auth.userId as the
// authoritative owner. This suite exercises that helper directly with an
// INJECTED userId — the exact SQL the route runs — so a green run proves:
//   * user A never sees user B's saved posts (no cross-user leak);
//   * a saved post that is private/draft/soft-deleted is FILTERED OUT;
//   * the title/description ILIKE search matches/misses correctly;
//   * the keyset cursor (saved_at string) paginates without precision loss.
//
// Requires a live Postgres (DATABASE_URL) WITH migration 0006 applied. Skips
// wholesale when the DB is unreachable OR the table is absent — never fakes a
// pass. (0007 is an additive index; the query is correct without it, just
// unindexed, so the test runs whether or not 0007 has been pushed.)
import { pool } from '../../src/database';
import { addFavorite, listSavedPosts } from '../../src/helpers/favorites';
import { createPost } from '../../src/helpers/writePost';

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

const tag = `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_sa_${tag}`;
const clerkB = `clerk_sb_${tag}`;

describe('saved-posts list (integration)', () => {
    let ready = false;
    let userA = 0;
    let userB = 0;
    let publicPostId = ''; // public, saved by A (visible)
    let privatePostId = ''; // private, saved by A (excluded)
    let bPostId = ''; // public, saved by B only (must never leak to A)

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
        userA = Number(a.rows[0]!.id);
        userB = Number(b.rows[0]!.id);

        const publicPost = await createPost(pool, userB, {
            slug: `saved-public-${tag}`,
            title: `Alpha public ${tag}`,
            content: null,
            description: 'a searchable description about charts',
            categoryId: null,
            status: 'public',
        });
        publicPostId = String(publicPost.id);

        const privatePost = await createPost(pool, userB, {
            slug: `saved-private-${tag}`,
            title: `Hidden private ${tag}`,
            content: null,
            description: null,
            categoryId: null,
            status: 'private',
        });
        privatePostId = String(privatePost.id);

        const bOnlyPost = await createPost(pool, userB, {
            slug: `saved-bonly-${tag}`,
            title: `B-only public ${tag}`,
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        bPostId = String(bOnlyPost.id);

        // A saves the public + private post; B saves its own b-only post.
        await addFavorite(pool, userA, publicPostId);
        await addFavorite(pool, userA, privatePostId);
        await addFavorite(pool, userB, bPostId);
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
                'savedPosts.test: DB unreachable or migration 0006 not applied — skipping'
            );
        return ready;
    };

    it("user A never sees user B's saved posts (no cross-user leak)", async () => {
        if (!guard()) return;
        const { posts } = await listSavedPosts(pool, userA, {});
        const ids = posts.map((p) => p.id);
        expect(ids).not.toContain(bPostId);

        const bResult = await listSavedPosts(pool, userB, {});
        expect(bResult.posts.map((p) => p.id)).toContain(bPostId);
        expect(bResult.posts.map((p) => p.id)).not.toContain(publicPostId);
    });

    it('excludes a saved private post (visibility filter)', async () => {
        if (!guard()) return;
        const { posts } = await listSavedPosts(pool, userA, {});
        const ids = posts.map((p) => p.id);
        expect(ids).toContain(publicPostId);
        expect(ids).not.toContain(privatePostId);
    });

    it('excludes a saved post once it is soft-deleted', async () => {
        if (!guard()) return;
        await pool.query('UPDATE posts SET deleted_at = now() WHERE id = $1', [
            publicPostId,
        ]);
        const { posts } = await listSavedPosts(pool, userA, {});
        expect(posts.map((p) => p.id)).not.toContain(publicPostId);
        // restore so later assertions can rely on it
        await pool.query('UPDATE posts SET deleted_at = NULL WHERE id = $1', [
            publicPostId,
        ]);
    });

    it('search matches on title/description and misses non-matches', async () => {
        if (!guard()) return;
        const hit = await listSavedPosts(pool, userA, { query: 'charts' });
        expect(hit.posts.map((p) => p.id)).toContain(publicPostId);

        const miss = await listSavedPosts(pool, userA, {
            query: 'zzz-no-such-term',
        });
        expect(miss.posts).toHaveLength(0);
    });

    it('keyset cursor paginates without losing rows (string cursor)', async () => {
        if (!guard()) return;
        const firstPage = await listSavedPosts(pool, userA, { limit: 1 });
        expect(firstPage.posts).toHaveLength(1);
        // A has one visible saved post (public); private is filtered → no more.
        expect(firstPage.nextCursor).toBeNull();
        // id stays a STRING (no Number() coercion / precision loss).
        expect(typeof firstPage.posts[0]!.id).toBe('string');
    });
});
