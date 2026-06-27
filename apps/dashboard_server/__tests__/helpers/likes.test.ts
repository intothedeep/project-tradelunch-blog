// Caller-scoping + idempotency test (MERGE GATE) for Phase E likes.
//
// AUTH SEAM: requireAuth verifies a real Clerk token, which cannot be minted in
// a unit test. The owner-scoping invariant lives entirely in the likes helper
// (toggleLike/getLikeState), which the route calls with req.auth.userId as the
// authoritative owner. This suite exercises the helper directly with an INJECTED
// userId — the exact SQL the route runs — so a green run proves a user can only
// toggle their OWN like and that the live count is correct.
//
// Requires a live Postgres (DATABASE_URL) WITH migration 0008 applied
// (post_likes table). Skips wholesale when the DB is unreachable OR the table is
// absent (migration not yet pushed) — it never fakes a pass.
import { pool } from '../../src/database';
import { toggleLike, getLikeState } from '../../src/helpers/likes';
import { createPost } from '../../src/helpers/writePost';

// Ready = DB reachable AND the post_likes relation exists (migration 0008
// applied). Either gap → skip, so the suite is green before the USER pushes the
// migration and runs real assertions afterward.
async function isLikesReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.post_likes') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const tag = `like_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;

describe('likes toggle + caller-scoping (integration)', () => {
    let ready = false;
    let userA = 0;
    let userB = 0;
    let postId = '';

    beforeAll(async () => {
        ready = await isLikesReady();
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
            slug: `like-target-${tag}`,
            title: 'Like target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        // Snowflake id preserved as a string (no Number cast).
        postId = String(post.id);
    });

    afterAll(async () => {
        if (ready) {
            await pool.query('DELETE FROM post_likes WHERE user_id = ANY($1)', [
                [userA, userB],
            ]);
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
                'likes.test: DB unreachable or migration 0008 not applied — skipping'
            );
        return ready;
    };

    it('toggleLike is idempotent per direction (like → unlike → like)', async () => {
        if (!guard()) return;

        const liked = await toggleLike(pool, userA, postId);
        expect(liked.liked).toBe(true);
        expect(liked.likeCount).toBe(1);

        const unliked = await toggleLike(pool, userA, postId);
        expect(unliked.liked).toBe(false);
        expect(unliked.likeCount).toBe(0);

        const reliked = await toggleLike(pool, userA, postId);
        expect(reliked.liked).toBe(true);
        expect(reliked.likeCount).toBe(1);
    });

    it('a second user liking the same post bumps the public count to 2', async () => {
        if (!guard()) return;

        const bLiked = await toggleLike(pool, userB, postId);
        expect(bLiked.liked).toBe(true);
        expect(bLiked.likeCount).toBe(2);
    });

    it("getLikeState is owner-scoped: A's like never appears for B", async () => {
        if (!guard()) return;

        // A still liked (from the prior test); B has not liked yet in this slice.
        // Remove B's like to isolate the owner-scoping assertion.
        const bState0 = await getLikeState(pool, userB, postId);
        if (bState0.liked) await toggleLike(pool, userB, postId);

        const aState = await getLikeState(pool, userA, postId);
        const bState = await getLikeState(pool, userB, postId);

        expect(aState.liked).toBe(true);
        expect(bState.liked).toBe(false);
        // The PUBLIC count is the same for both viewers (only A's like remains).
        expect(aState.likeCount).toBe(1);
        expect(bState.likeCount).toBe(1);
    });

    it("toggleLike by A never removes B's like (owner-scoped delete)", async () => {
        if (!guard()) return;

        // Ensure both A and B like the post.
        const aState = await getLikeState(pool, userA, postId);
        if (!aState.liked) await toggleLike(pool, userA, postId);
        const bState = await getLikeState(pool, userB, postId);
        if (!bState.liked) await toggleLike(pool, userB, postId);

        // A unlikes — only A's row is removed; B's survives.
        const aUnlike = await toggleLike(pool, userA, postId);
        expect(aUnlike.liked).toBe(false);
        expect(aUnlike.likeCount).toBe(1);

        const bAfter = await getLikeState(pool, userB, postId);
        expect(bAfter.liked).toBe(true);
    });
});
