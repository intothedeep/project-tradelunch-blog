// Purpose: threaded-comment routes (Phase E — Option C). Two routers:
//   * postCommentsRouter (mounted at /api/posts):
//       - POST   /:postId/comments  (requireAuth)  → create comment/reply, 201
//       - GET    /:postId/comments  (optionalAuth)  → paged pre-order tree
//                                                     query: ?cursor=<rootId>&limit=<1..100,default 50>
//                                                     page = 50 ROOT comments (newest-first), each WITH its full
//                                                     subtree (replies don't count); returns { comments, nextCursor, hasMore }
//   * commentsRouter (mounted at /api/comments):
//       - PATCH  /:commentId        (requireAuth)  → edit body (author/owner/admin), 200
//       - DELETE /:commentId        (requireAuth)  → soft-delete (author/owner/admin)
// Invariants:
//   * Snowflake ids are STRINGS end-to-end — :postId/:commentId pass to the
//     helper verbatim (never Number()/parseInt, which truncates).
//   * Create is owner-scoped: user_id is ALWAYS req.auth.userId (never client).
//   * Body is PLAIN TEXT (not markdown): trimmed, non-empty, length-capped here;
//     never rendered/parsed server-side.
//   * Read is public via optionalAuth (viewer-agnostic tree).
//   * Edit/Delete authorization (author OR post owner OR admin) lives in the
//     helper; the route maps its typed errors to 403/404/409.
//   * Edit of a tombstone → CommentDeletedError → 409 (conflict, not 404).
// Side effects: DB reads/writes via the comments helpers.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { optionalAuth } from '../../middlewares/optionalAuth';
import {
    createComment,
    listCommentPage,
    softDeleteComment,
    updateComment,
    CommentParentError,
    CommentForbiddenError,
    CommentNotFoundError,
    CommentDeletedError,
} from '../../helpers/comments';
import type {
    TComment,
    TCommentCreateRequest,
    TCommentUpdateRequest,
    TCommentListResponse,
} from '@repo/types';

const MAX_BODY_LENGTH = 4000;

// Page size of ROOT comments. Default 50; clamped to [1, 100]. Mirrors the
// limit-clamp style used by the favorites / posts cursor routes.
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const CURSOR_SENTINEL = '9223372036854775807';

// Clamp the requested page size into [1, MAX_PAGE_LIMIT], defaulting when
// absent/invalid (a pure function: explicit in, explicit out, no IO).
function clampPageLimit(raw?: string): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_LIMIT;
    return Math.min(n, MAX_PAGE_LIMIT);
}

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

        // Keyset cursor = the last ROOT id of the previous page; the sentinel
        // (max bigint) starts at the newest. Reject a malformed cursor by
        // falling back to the sentinel rather than binding a bad BIGINT.
        const rawCursor =
            typeof req.query.cursor === 'string' ? req.query.cursor : '';
        const cursor = isValidId(rawCursor) ? rawCursor : CURSOR_SENTINEL;
        const limit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const { comments, nextCursor, hasMore } = await listCommentPage(
            pool,
            postId,
            { cursor, limit }
        );
        const payload: TCommentListResponse = { comments, nextCursor, hasMore };
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

commentsRouter.patch('/:commentId', requireAuth, async (req, res) => {
    try {
        const commentId = String(req.params.commentId);
        if (!isValidId(commentId)) {
            res.status(400).json({
                success: false,
                message: 'invalid comment id',
            });
            return;
        }

        const input = req.body as TCommentUpdateRequest;
        const body = typeof input.body === 'string' ? input.body.trim() : '';
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

        const comment = await updateComment(
            pool,
            commentId,
            req.auth!.userId,
            req.auth!.isAdmin,
            body
        );
        res.json({ success: true, data: comment });
    } catch (error) {
        if (error instanceof CommentNotFoundError) {
            res.status(404).json({ success: false, message: error.message });
            return;
        }
        if (error instanceof CommentDeletedError) {
            res.status(409).json({ success: false, message: error.message });
            return;
        }
        if (error instanceof CommentForbiddenError) {
            res.status(403).json({ success: false, message: error.message });
            return;
        }
        console.error('PATCH /api/comments/:commentId error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to update comment',
        });
    }
});

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
