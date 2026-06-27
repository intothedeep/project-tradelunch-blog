// Purpose: threaded-comment routes (Phase E — Option C). Two routers:
//   * postCommentsRouter (mounted at /api/posts):
//       - POST   /:postId/comments  (requireAuth)  → create comment/reply, 201
//       - GET    /:postId/comments  (optionalAuth)  → flat pre-order tree
//   * commentsRouter (mounted at /api/comments):
//       - DELETE /:commentId        (requireAuth)  → soft-delete (author/owner/admin)
// Invariants:
//   * Snowflake ids are STRINGS end-to-end — :postId/:commentId pass to the
//     helper verbatim (never Number()/parseInt, which truncates).
//   * Create is owner-scoped: user_id is ALWAYS req.auth.userId (never client).
//   * Body is PLAIN TEXT (not markdown): trimmed, non-empty, length-capped here;
//     never rendered/parsed server-side.
//   * Read is public via optionalAuth (viewer-agnostic tree).
//   * Delete authorization (author OR post owner OR admin) lives in the helper;
//     the route maps its typed errors to 403/404.
// Side effects: DB reads/writes via the comments helpers.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { optionalAuth } from '../../middlewares/optionalAuth';
import {
    createComment,
    listCommentTree,
    softDeleteComment,
    CommentParentError,
    CommentForbiddenError,
    CommentNotFoundError,
} from '../../helpers/comments';
import type {
    TComment,
    TCommentCreateRequest,
    TCommentListResponse,
} from '@repo/types';

const MAX_BODY_LENGTH = 4000;

// A Snowflake id is a non-empty run of digits; reject anything else with 400
// before binding so node-pg never raises a 500 on a malformed BIGINT.
function isValidId(value: string): boolean {
    return /^\d+$/.test(value);
}

// Routes that nest a comment under a post: /api/posts/:postId/comments.
export const postCommentsRouter = Router();

postCommentsRouter.get('/:postId/comments', optionalAuth, async (req, res) => {
    try {
        const postId = String(req.params.postId);
        if (!isValidId(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        const comments = await listCommentTree(pool, postId);
        const payload: TCommentListResponse = { comments };
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('GET /api/posts/:postId/comments error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to load comments',
        });
    }
});

postCommentsRouter.post(
    '/:postId/comments',
    requireAuth,
    async (req, res) => {
        try {
            const postId = String(req.params.postId);
            if (!isValidId(postId)) {
                res.status(400).json({
                    success: false,
                    message: 'invalid post id',
                });
                return;
            }

            const input = req.body as TCommentCreateRequest;
            const body =
                typeof input.body === 'string' ? input.body.trim() : '';
            if (body.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'comment body is required',
                });
                return;
            }
            if (body.length > MAX_BODY_LENGTH) {
                res.status(400).json({
                    success: false,
                    message: 'comment body is too long',
                });
                return;
            }

            const parentId =
                typeof input.parentId === 'string' && input.parentId.length > 0
                    ? input.parentId
                    : null;
            if (parentId !== null && !isValidId(parentId)) {
                res.status(400).json({
                    success: false,
                    message: 'invalid parent id',
                });
                return;
            }

            const comment: TComment = await createComment(
                pool,
                req.auth!.userId,
                postId,
                parentId,
                body
            );
            res.status(201).json({ success: true, data: comment });
        } catch (error) {
            // A reply to a deleted/foreign-post parent → 400 (client error).
            if (error instanceof CommentParentError) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            // FK violation (23503) = post_id does not exist → 404, not a 500.
            if ((error as { code?: string }).code === '23503') {
                res.status(404).json({
                    success: false,
                    message: 'post not found',
                });
                return;
            }
            console.error('POST /api/posts/:postId/comments error:', error);
            res.status(500).json({
                success: false,
                message: 'failed to create comment',
            });
        }
    }
);

// Routes keyed by a comment id directly: /api/comments/:commentId.
export const commentsRouter = Router();

commentsRouter.delete('/:commentId', requireAuth, async (req, res) => {
    try {
        const commentId = String(req.params.commentId);
        if (!isValidId(commentId)) {
            res.status(400).json({
                success: false,
                message: 'invalid comment id',
            });
            return;
        }

        const comment = await softDeleteComment(
            pool,
            commentId,
            req.auth!.userId,
            req.auth!.isAdmin
        );
        res.json({ success: true, data: comment });
    } catch (error) {
        if (error instanceof CommentNotFoundError) {
            res.status(404).json({ success: false, message: error.message });
            return;
        }
        if (error instanceof CommentForbiddenError) {
            res.status(403).json({ success: false, message: error.message });
            return;
        }
        console.error('DELETE /api/comments/:commentId error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to delete comment',
        });
    }
});
