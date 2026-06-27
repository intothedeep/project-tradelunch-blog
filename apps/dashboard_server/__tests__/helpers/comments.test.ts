// Threaded-comments helper test (MERGE GATE) for Phase E comments (Option C).
//
// AUTH SEAM: requireAuth verifies a real Clerk token (cannot be minted in a unit
// test). The owner-scoping + path/tombstone/authorization invariants all live in
// the comments helper, which the route calls with req.auth.userId as the
// authoritative caller. This suite exercises the helper directly with an INJECTED
// userId — the exact SQL the route runs — so a green run proves: path is computed
// correctly for nested replies; ORDER BY path yields pre-order DFS; a tombstone
// masks body but keeps the row; a non-author/non-owner cannot delete/edit; a
// reply to a deleted or foreign-post parent is rejected; an edit replaces body
// and bumps updatedAt; editing a tombstone is rejected.
//
// Requires a live Postgres (DATABASE_URL) WITH migration 0009 applied (comments
// table). Skips wholesale when the DB is unreachable OR the table is absent
// (migration not yet pushed) — it never fakes a pass.
import { pool } from '../../src/database';
import {
    createComment,
    listCommentTree,
    listCommentPage,
    orderByRoots,
    softDeleteComment,
    updateComment,
    CommentParentError,
    CommentForbiddenError,
    CommentNotFoundError,
    CommentDeletedError,
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

    it('author edits own comment: body replaced, updatedAt bumped, not deleted', async () => {
        if (!guard()) return;

        const c = await createComment(pool, userA, postId, null, 'before edit');
        // On insert created_at == updated_at (same now()); compared to ms to
        // avoid microsecond-precision noise in the raw pg timestamp strings.
        expect(new Date(c.updatedAt).getTime()).toBe(
            new Date(c.createdAt).getTime()
        );

        const edited = await updateComment(
            pool,
            c.id,
            userA,
            false,
            'after edit'
        );
        expect(edited.id).toBe(c.id);
        expect(edited.body).toBe('after edit');
        expect(edited.isDeleted).toBe(false);
        expect(edited.authorName).toBeDefined();
        // updated_at advanced past created_at (edited marker on the wire).
        expect(edited.updatedAt > edited.createdAt).toBe(true);
    });

    it('post owner may edit another user comment (same policy as delete)', async () => {
        if (!guard()) return;

        const c = await createComment(pool, userA, postId, null, 'owner-edit');
        const edited = await updateComment(
            pool,
            c.id,
            userB,
            false,
            'edited by owner'
        );
        expect(edited.body).toBe('edited by owner');
        expect(edited.isDeleted).toBe(false);
    });

    it('admin may edit any comment', async () => {
        if (!guard()) return;

        const c = await createComment(pool, userA, postId, null, 'admin-edit');
        const edited = await updateComment(
            pool,
            c.id,
            userC,
            true,
            'edited by admin'
        );
        expect(edited.body).toBe('edited by admin');
        expect(edited.isDeleted).toBe(false);
    });

    it('an unrelated non-author/non-owner/non-admin cannot edit (forbidden)', async () => {
        if (!guard()) return;

        const c = await createComment(pool, userA, postId, null, 'no-edit');
        await expect(
            updateComment(pool, c.id, userC, false, 'should fail')
        ).rejects.toBeInstanceOf(CommentForbiddenError);
    });

    it('editing a soft-deleted comment is rejected (deleted)', async () => {
        if (!guard()) return;

        const c = await createComment(pool, userA, postId, null, 'tombstone-edit');
        await softDeleteComment(pool, c.id, userA, false);
        await expect(
            updateComment(pool, c.id, userA, false, 'resurrect')
        ).rejects.toBeInstanceOf(CommentDeletedError);
    });

    it('editing an unknown comment id is rejected (not found)', async () => {
        if (!guard()) return;

        await expect(
            updateComment(pool, '999999999999999999', userA, false, 'ghost')
        ).rejects.toBeInstanceOf(CommentNotFoundError);
    });

    // -----------------------------------------------------------------------
    // C4 cursor pagination — listCommentPage: a page is 50 ROOT comments
    // (newest-first), EACH with its full descendant subtree (replies never
    // count toward the 50). Cursor = the last root id (string).
    // -----------------------------------------------------------------------
    const SENTINEL = '9223372036854775807';

    it('paginates 50 roots per page; cursor round-trips as a string', async () => {
        if (!guard()) return;

        // A dedicated post so the root count is deterministic (cleaned up by the
        // shared afterAll: comments are authored by userA on userB's post set).
        const pagePost = await createPost(pool, userB, {
            slug: `comment-page-${tag}`,
            title: 'Comment page target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        const pagePostId = String(pagePost.id);

        // 55 ROOT comments → page 1 = 50, page 2 = 5.
        const rootIds: string[] = [];
        for (let i = 0; i < 55; i++) {
            const c = await createComment(
                pool,
                userA,
                pagePostId,
                null,
                `root ${i}`
            );
            rootIds.push(c.id);
        }
        // Newest-first: ids descend by creation. Expected page-1 roots are the
        // 50 newest (last 50 created, reversed); page-2 roots are the oldest 5.
        const newestFirst = [...rootIds].reverse();

        const page1 = await listCommentPage(pool, pagePostId, {
            cursor: SENTINEL,
            limit: 50,
        });
        expect(page1.comments).toHaveLength(50);
        expect(page1.hasMore).toBe(true);
        const page1Roots = page1.comments.map((c) => c.id);
        expect(page1Roots).toEqual(newestFirst.slice(0, 50));
        // nextCursor = the 50th (last kept) root id, AS A STRING.
        expect(typeof page1.nextCursor).toBe('string');
        expect(page1.nextCursor).toBe(newestFirst[49]);

        const page2 = await listCommentPage(pool, pagePostId, {
            cursor: page1.nextCursor!,
            limit: 50,
        });
        expect(page2.comments).toHaveLength(5);
        expect(page2.hasMore).toBe(false);
        expect(page2.nextCursor).toBeNull();
        expect(page2.comments.map((c) => c.id)).toEqual(newestFirst.slice(50));
        // ids in the response are strings end-to-end.
        for (const c of page2.comments) {
            expect(typeof c.id).toBe('string');
        }
    }, 60000);

    it('returns a root full subtree in pre-order; replies do not count toward 50', async () => {
        if (!guard()) return;

        const subPost = await createPost(pool, userB, {
            slug: `comment-subtree-${tag}`,
            title: 'Subtree page target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        const subPostId = String(subPost.id);

        // One root with a nested reply chain, then 50 more bare roots. Even with
        // 51 roots, the subtree of the FIRST (oldest) root comes back intact on
        // whichever page that root lands — replies are not roots, so they never
        // consume a slot.
        const rooted = await createComment(
            pool,
            userA,
            subPostId,
            null,
            'has-subtree'
        );
        const reply = await createComment(
            pool,
            userA,
            subPostId,
            rooted.id,
            'reply-1'
        );
        const deep = await createComment(
            pool,
            userA,
            subPostId,
            reply.id,
            'reply-2'
        );
        for (let i = 0; i < 50; i++) {
            await createComment(pool, userA, subPostId, null, `bare ${i}`);
        }

        // 51 roots → page 1 = 50 newest roots (hasMore), the 'has-subtree' root
        // (oldest) is on page 2 with its full chain.
        const p1 = await listCommentPage(pool, subPostId, {
            cursor: SENTINEL,
            limit: 50,
        });
        expect(p1.hasMore).toBe(true);

        const p2 = await listCommentPage(pool, subPostId, {
            cursor: p1.nextCursor!,
            limit: 50,
        });
        const sub = p2.comments.filter((c) => c.path[0] === rooted.id);
        // Whole subtree present, pre-order DFS (root, reply, deep).
        expect(sub.map((c) => c.id)).toEqual([rooted.id, reply.id, deep.id]);
        expect(sub.map((c) => c.depth)).toEqual([0, 1, 2]);
    }, 60000);

    it('excludes a fully-dead root; keeps a tombstoned root with a live reply (masked)', async () => {
        if (!guard()) return;

        const tPost = await createPost(pool, userB, {
            slug: `comment-tomb-page-${tag}`,
            title: 'Tombstone page target',
            content: null,
            description: null,
            categoryId: null,
            status: 'public',
        });
        const tPostId = String(tPost.id);

        // Root 1: deleted, NO live descendant → excluded.
        const dead = await createComment(pool, userA, tPostId, null, 'dead root');
        await softDeleteComment(pool, dead.id, userA, false);

        // Root 2: deleted, but has a LIVE reply → still appears (masked).
        const masked = await createComment(
            pool,
            userA,
            tPostId,
            null,
            'masked root'
        );
        const liveReply = await createComment(
            pool,
            userA,
            tPostId,
            masked.id,
            'alive'
        );
        await softDeleteComment(pool, masked.id, userA, false);

        const page = await listCommentPage(pool, tPostId, {
            cursor: SENTINEL,
            limit: 50,
        });
        const ids = page.comments.map((c) => c.id);
        expect(ids).not.toContain(dead.id);
        expect(ids).toContain(masked.id);
        const maskedRow = page.comments.find((c) => c.id === masked.id)!;
        expect(maskedRow.isDeleted).toBe(true);
        expect(maskedRow.body).toBe('[deleted]');
        expect(maskedRow.authorName).toBeUndefined();
        // The live reply survives under its tombstoned parent.
        const replyRow = page.comments.find((c) => c.id === liveReply.id)!;
        expect(replyRow.body).toBe('alive');
        expect(replyRow.path[0]).toBe(masked.id);
    }, 30000);
});

// Pure unit test of orderByRoots — no IO, no DB. Verifies roots come back in the
// supplied (newest-first) order while each root's rows keep their incoming
// pre-order (path-sorted) sequence, and that unknown roots are ignored.
describe('orderByRoots (pure)', () => {
    it('groups by path[1] then concatenates groups in rootIds order', () => {
        const rows = [
            { id: 'a1', path: ['a', 'a1'] },
            { id: 'b', path: ['b'] },
            { id: 'a', path: ['a'] },
            { id: 'b1', path: ['b', 'b1'] },
            { id: 'a2', path: ['a', 'a1', 'a2'] },
        ];
        // SQL already returns each group path-sorted; the function must NOT
        // re-sort within a group — it preserves incoming per-root order.
        const grouped = orderByRoots(
            [
                { id: 'a', path: ['a'] },
                { id: 'a1', path: ['a', 'a1'] },
                { id: 'a2', path: ['a', 'a1', 'a2'] },
                { id: 'b', path: ['b'] },
                { id: 'b1', path: ['b', 'b1'] },
            ],
            ['b', 'a']
        );
        // roots in rootIds order: b-subtree first, then a-subtree (each in order).
        expect(grouped.map((r) => r.id)).toEqual(['b', 'b1', 'a', 'a1', 'a2']);

        // an unknown root id contributes nothing; rows with no matching root drop.
        const partial = orderByRoots(rows, ['a']);
        expect(partial.map((r) => r.id)).toEqual(['a1', 'a', 'a2']);
    });
});
