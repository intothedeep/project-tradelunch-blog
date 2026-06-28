// Purpose: admin post-moderation routes (list any author's posts / change status /
//          soft-delete by id). Every route is gated by requireAdmin and is
//          NON-owner-scoped — the SQL acts on a post by id regardless of author.
// Invariants:
//   * Authorization is solely requireAdmin (requireAuth + isAdmin assertion).
//   * Delete is SOFT (helpers/adminPosts.adminSoftDeletePost), never hard.
// Side effects: DB reads/writes via the adminPosts helpers.
import { Router, type Request, type Response } from 'express';
import { pool } from '../../database';
import { requireAdmin } from '../../middlewares/requireAdmin';
import { validatePostStatus } from '../../helpers/validatePostStatus';
import {
    listAllPosts,
    setPostStatus,
    adminSoftDeletePost,
} from '../../helpers/adminPosts';
import type { TAdminPostListResponse } from '@repo/types';

export const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

router.get('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const rawCursor =
            typeof req.query.cursor === 'string' ? req.query.cursor : '';
        const cursor =
            /^\d+$/.test(rawCursor) && rawCursor !== '0' ? rawCursor : null;

        const rawLimit = parseInt(String(req.query.limit ?? ''), 10);
        const limit = Math.min(
            Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT,
            MAX_LIMIT
        );

        const data: TAdminPostListResponse = await listAllPosts(pool, {
            cursor,
            limit,
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error('GET /api/admin/posts error:', error);
        res.status(500).json({ success: false, message: 'failed to list posts' });
    }
});

router.patch('/:postid/status', requireAdmin, async (req: Request, res: Response) => {
    try {
        // postId is a BIGINT — keep it a numeric STRING; never parseInt (precision).
        const postId = String(req.params.postid);
        if (!/^\d+$/.test(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        const parsed = validatePostStatus(
            (req.body as { status?: unknown } | undefined)?.status
        );
        if (!parsed.ok) {
            res.status(400).json({ success: false, message: parsed.reason });
            return;
        }

        const row = await setPostStatus(pool, postId, parsed.value);
        if (!row) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }

        res.json({ success: true, data: row });
    } catch (error) {
        console.error('PATCH /api/admin/posts/:postid/status error:', error);
        res.status(500).json({ success: false, message: 'failed to set status' });
    }
});

router.delete('/:postid', requireAdmin, async (req: Request, res: Response) => {
    try {
        // postId is a BIGINT — keep it a numeric STRING; never parseInt (precision).
        const postId = String(req.params.postid);
        if (!/^\d+$/.test(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        const deletedId = await adminSoftDeletePost(pool, postId);
        if (deletedId === null) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }

        res.json({ success: true, data: { id: deletedId } });
    } catch (error) {
        console.error('DELETE /api/admin/posts/:postid error:', error);
        res.status(500).json({ success: false, message: 'failed to delete post' });
    }
});

export default router;
