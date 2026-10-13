// Purpose: like toggle route for a post. POST /v1/api/posts/:postId/like is
//          gated by requireAuth and acts ONLY on req.auth.userId — a
//          client-supplied user id is never trusted. Mounted at /v1/api/posts
//          (alongside the posts router) so the toggle nests under the post.
// Invariants:
//   * Snowflake post ids are STRINGS end-to-end — req.params.postId is passed to
//     the helper verbatim (never Number()/parseInt, which would truncate).
//   * The toggle is owner-scoped to req.auth.userId, so one user cannot toggle
//     another user's like.
//   * A like is a PUBLIC approval signal: the response returns liked + a live
//     likeCount (TLikeToggleResponse).
//   * The viewer-likes list (GET /v1/api/likes) is a SEPARATE router so it can
//     mount at its own prefix without colliding with the post feed's GET
//     /api/posts; it returns the caller's OWN liked ids (TLikedResponse).
// Side effects: a DB transaction via the likes helper.
import { isValidBigintId } from '../../utils/id.utils';
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { toggleLike, listLikedPostIds } from '../../helpers/likes';
import type { TLikeToggleResponse, TLikedResponse } from '@repo/types';

const router = Router();

router.post('/:postId/like', requireAuth, async (req, res) => {
    try {
        const postId = String(req.params.postId);
        if (!isValidBigintId(postId)) {
            res.status(400).json({
                success: false,
                message: 'invalid post id',
            });
            return;
        }

        const { liked, likeCount } = await toggleLike(
            pool,
            req.auth!.userId,
            postId
        );
        const payload: TLikeToggleResponse = { liked, likeCount };
        res.json({ success: true, data: payload });
    } catch (error) {
        // FK violation (23503) = post_id does not exist → 404, not a 500.
        if ((error as { code?: string }).code === '23503') {
            res.status(404).json({ success: false, message: 'post not found' });
            return;
        }
        req.log.error({ err: error }, 'POST /api/posts/:postId/like');
        res.status(500).json({
            success: false,
            message: 'failed to toggle like',
        });
    }
});

// Caller-scoped list of the viewer's OWN liked post ids. Mounted at
// /v1/api/likes (its own prefix) so it never collides with the public feed at
// GET /api/posts. Lets the client seed LikeButton state without forwarding a
// token through the cacheable SSR post read.
export const likesListRouter = Router();

likesListRouter.get('', requireAuth, async (req, res) => {
    try {
        const postIds = await listLikedPostIds(pool, req.auth!.userId);
        const payload: TLikedResponse = { postIds };
        res.json({ success: true, data: payload });
    } catch (error) {
        req.log.error({ err: error }, 'GET /api/likes');
        res.status(500).json({
            success: false,
            message: 'failed to load likes',
        });
    }
});

export default router;
