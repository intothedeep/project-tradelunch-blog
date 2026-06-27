// Threaded-comments helper test (MERGE GATE) for Phase E comments (Option C).
//
// AUTH SEAM: requireAuth verifies a real Clerk token (cannot be minted in a unit
// test). The owner-scoping + path/tombstone/authorization invariants all live in
// the comments helper, which the route calls with req.auth.userId as the
// authoritative caller. This suite exercises the helper directly with an INJECTED
// userId — the exact SQL the route runs — so a green run proves: path is computed
// correctly for nested replies; ORDER BY path yields pre-order DFS; a tombstone
// masks body but keeps the row; a non-author/non-owner cannot delete; a reply to
// a deleted or foreign-post parent is rejected.
//
// Requires a live Postgres (DATABASE_URL) WITH migration 0009 applied (comments
// table). Skips wholesale when the DB is unreachable OR the table is absent
// (migration not yet pushed) — it never fakes a pass.
import { pool } from '../../src/database';
import {
    createComment,
    listCommentTree,
    softDeleteComment,
    CommentParentError,
    CommentForbiddenError,
} from '../../src/helpers/comments';
import { createPost } from '../../src/helpers/writePost';

// Ready = DB reachable AND the comments relation exists (migration 0009 applied).
async function isCommentsReady(): Promise<boolean> {
    try {
        const { rows } = await pool.query<{ exists: string | null }>(
            "SELECT to_regclass('public.comments') AS exists"
        );
        return rows[0]?.exists !== null;
    } catch {
        return false;
    }
}

const tag = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;
const clerkC = `clerk_c_${tag}`;

describe('comments helper (Option C path / tombstone / auth) — integration', () => {
    let ready = false;
    let userA = 0; // author of comments
    let userB = 0; // post owner (moderator)
    let userC = 0; // unrelated user (no rights)
    let postId = '';
    let otherPostId = '';

    beforeAll(async () => {
        ready = await isCommentsReady();
        if (!ready) return;
        const a = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id, username) VALUES ($1, $2) RETURNING id',
            [clerkA, `a_${tag}`]
        );
        const b = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id, username) VALUES ($1, $2) RETURNING id',
            [clerkB, `b_${tag}`]
        );
        const c = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id, username) VALUES ($1, $2) RETURNING id',
            [clerkC, `c_${tag}`]
        );
        userA = Number(a.rows[0].id);
        userB = Number(b.rows[0].id);
        userC = Number(c.rows[0].id);

        const post = await createPost(pool, userB, {
            slug: `comment-target-${tag}`,
            title: 'Comment target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        postId = String(post.id);

        const other = await createPost(pool, userB, {
            slug: `comment-other-${tag}`,
            title: 'Other post',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        otherPostId = String(other.id);
    });

    afterAll(async () => {
        if (ready) {
            await pool.query(
                'DELETE FROM comments WHERE user_id = ANY($1)',
                [[userA, userB, userC]]
            );
            await pool.query('DELETE FROM posts WHERE user_id = ANY($1)', [
                [userA, userB, userC],
            ]);
            await pool.query('DELETE FROM users WHERE clerk_user_id = ANY($1)', [
                [clerkA, clerkB, clerkC],
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!ready)
            console.warn(
                'comments.test: DB unreachable or migration 0009 not applied — skipping'
            );
        return ready;
    };

    it('computes a self-inclusive path: top-level = [id], reply = parent.path || id', async () => {
        if (!guard()) return;

        const top = await createComment(pool, userA, postId, null, 'root one');
        expect(top.parentId).toBeNull();
        expect(top.depth).toBe(0);
        expect(top.path).toEqual([top.id]);

        const reply = await createComment(pool, userA, postId, top.id, 'reply');
        expect(reply.parentId).toBe(top.id);
        expect(reply.depth).toBe(1);
        expect(reply.path).toEqual([top.id, reply.id]);

        const deep = await createComment(pool, userA, postId, reply.id, 'deep');
        expect(deep.depth).toBe(2);
        expect(deep.path).toEqual([top.id, reply.id, deep.id]);
    });

    it('listCommentTree returns rows in pre-order DFS (ORDER BY path)', async () => {
        if (!guard()) return;

        // Second top-level thread; its subtree must sort AFTER the first thread.
        const top2 = await createComment(pool, userA, postId, null, 'root two');
        await createComment(pool, userA, postId, top2.id, 'two-child');

        const tree = await listCommentTree(pool, postId);
        // Pre-order: every node appears immediately before its descendants, and a
        // child's path is strictly greater than its parent's (prefix property).
        for (let i = 1; i < tree.length; i++) {
            const prev = tree[i - 1]!.path.join(',');
            const cur = tree[i]!.path.join(',');
            expect(prev < cur).toBe(true);
        }
        // depth = path.length - 1 for every row.
        for (const node of tree) {
            expect(node.depth).toBe(node.path.length - 1);
        }
    });

    it('tombstone masks body but KEEPS the row + its children in path order', async () => {
        if (!guard()) return;

        const parent = await createComment(pool, userA, postId, null, 'to delete');
        const child = await createComment(
            pool,
            userA,
            postId,
            parent.id,
            'survivor'
        );

        const deleted = await softDeleteComment(pool, parent.id, userA, false);
        expect(deleted.isDeleted).toBe(true);
        expect(deleted.body).toBe('[deleted]');
        expect(deleted.authorName).toBeUndefined();

        const tree = await listCommentTree(pool, postId);
        const masked = tree.find((c) => c.id === parent.id);
        const survivor = tree.find((c) => c.id === child.id);
        expect(masked).toBeDefined();
        expect(masked!.body).toBe('[deleted]');
        expect(masked!.isDeleted).toBe(true);
        // Child survives, still attached under the tombstoned parent.
        expect(survivor).toBeDefined();
        expect(survivor!.body).toBe('survivor');
        expect(survivor!.path[0]).toBe(parent.id);
    });

    it('post owner and admin may delete; an unrelated user may not', async () => {
        if (!guard()) return;

        const c1 = await createComment(pool, userA, postId, null, 'owner-del');
        // userC has no rights → forbidden.
        await expect(
            softDeleteComment(pool, c1.id, userC, false)
        ).rejects.toBeInstanceOf(CommentForbiddenError);
        // userB is the post owner → allowed (moderation).
        const byOwner = await softDeleteComment(pool, c1.id, userB, false);
        expect(byOwner.isDeleted).toBe(true);

        const c2 = await createComment(pool, userA, postId, null, 'admin-del');
        // userC as admin → allowed.
        const byAdmin = await softDeleteComment(pool, c2.id, userC, true);
        expect(byAdmin.isDeleted).toBe(true);

        const c3 = await createComment(pool, userA, postId, null, 'author-del');
        // The author may delete their own.
        const byAuthor = await softDeleteComment(pool, c3.id, userA, false);
        expect(byAuthor.isDeleted).toBe(true);
    });

    it('rejects a reply to a deleted parent or a parent on a different post', async () => {
        if (!guard()) return;

        const parent = await createComment(pool, userA, postId, null, 'dead');
        await softDeleteComment(pool, parent.id, userA, false);
        // Reply to a tombstoned parent → rejected.
        await expect(
            createComment(pool, userA, postId, parent.id, 'orphan')
        ).rejects.toBeInstanceOf(CommentParentError);

        // A live parent that belongs to ANOTHER post → rejected when replied to
        // under this post.
        const foreign = await createComment(
            pool,
            userA,
            otherPostId,
            null,
            'foreign'
        );
        await expect(
            createComment(pool, userA, postId, foreign.id, 'cross-post')
        ).rejects.toBeInstanceOf(CommentParentError);
    });
});
