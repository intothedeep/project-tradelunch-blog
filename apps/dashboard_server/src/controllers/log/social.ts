// Purpose: Social routes for the Log micro-feed (Phase Y-M2).
//   POST /log/:id/like  — toggle the caller's like on a log node (requireAuth).
//   GET  /log/:id/like  — read like state (optionalAuth; viewerLiked when authed).
//   GET  /log/timeline  — viewer's followed-users fan-in feed (requireAuth).
//
// Route order: these routes MUST be registered before /:username and /:id in the
// parent logRouter so the literal segments ('timeline', ':id/like') are not
// captured by bare param matchers.
//
// Feature-guard: when migration 0024 has not been applied, like toggle returns
// 503 and timeline returns empty. This keeps the existing suite green.
//
// Invariants:
//   * BIGINT ids are STRINGS end-to-end (never Number()/parseInt an id).
//   * sendOk/sendError from helpers/response (shared { success, data } envelope).
//   * Touches only log, log_likes, follows, users (never posts/comments).
// Side effects: DB reads/writes via pool.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { optionalAuth } from '../../middlewares/optionalAuth';
import { sendOk, sendError } from '../../helpers/response';
import { toggleLogLike, getLogLikeState } from '../../helpers/log/likes';
import { listLogTimeline, TIMELINE_CURSOR_SENTINEL } from '../../helpers/log/timeline';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

function clampPageLimit(raw?: string): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_LIMIT;
    return Math.min(n, MAX_PAGE_LIMIT);
}

function isValidId(value: string): boolean {
    return /^\d+$/.test(value);
}

export const logSocialRouter = Router();

// GET /timeline — viewer's followed-users fan-in feed (requireAuth).
// Must be registered before /:id routes to prevent "timeline" being captured
// as an id param.
logSocialRouter.get('/timeline', requireAuth, async (req, res) => {
    try {
        const rawCursor =
            typeof req.query.cursor === 'string' ? req.query.cursor : '';
        const cursor = isValidId(rawCursor)
            ? rawCursor
            : TIMELINE_CURSOR_SENTINEL;
        const limit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const result = await listLogTimeline(
            pool,
            req.auth!.userId,
            cursor,
            limit
        );
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log/timeline error:', error);
        sendError(res, 500, 'failed to load timeline');
    }
});

// POST /:id/like — toggle the caller's like on a log node.
logSocialRouter.post('/:id/like', requireAuth, async (req, res) => {
    try {
        const logId = String(req.params.id);
        if (!isValidId(logId)) {
            sendError(res, 400, 'invalid log id');
            return;
        }

        const result = await toggleLogLike(pool, req.auth!.userId, logId);
        if (result === null) {
            sendError(
                res,
                503,
                'like feature not available (migration pending)'
            );
            return;
        }
        sendOk(res, result);
    } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'LOG_NOT_FOUND') {
            sendError(res, 404, 'log node not found');
            return;
        }
        if (err.code === 'LOG_DELETED') {
            sendError(res, 410, 'cannot like a deleted log node');
            return;
        }
        console.error('POST /api/log/:id/like error:', error);
        sendError(res, 500, 'failed to toggle like');
    }
});

// GET /:id/like — read like state (optionalAuth; viewerLiked when authed).
logSocialRouter.get('/:id/like', optionalAuth, async (req, res) => {
    try {
        const logId = String(req.params.id);
        if (!isValidId(logId)) {
            sendError(res, 400, 'invalid log id');
            return;
        }

        const viewerId = req.auth?.userId;
        const result = await getLogLikeState(pool, logId, viewerId);
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log/:id/like error:', error);
        sendError(res, 500, 'failed to read like state');
    }
});
