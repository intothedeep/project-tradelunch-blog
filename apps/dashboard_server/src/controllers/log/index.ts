// Purpose: Log micro-feed routes (Phase Y).
//   GET  /thread/:id       → focus-node view (ancestors+focus+depth-1 children)
//   GET  /:username        → top-level stream (newest-first keyset)
//   POST /                 → create top-level or reply (requireAuth)
//   DELETE /:id            → soft-delete (requireAuth)
//
// Route order: /thread/:id MUST be registered before /:username to prevent the
// literal "thread" segment being captured as a username param.
//
// Auth rules (per spec Phase Y):
//   * Top-level (parentId=null): OWNER-ONLY. A provisioned user's top-level
//     posts always go to their OWN stream (createLog always binds req.auth.userId).
//     The 403-else guard means: top-level creation is blocked for accounts that
//     have no username yet (unprovisioned — already caught by requireAuth).
//     We enforce "owner-only" by checking req.auth.username is non-null, since
//     a provisioned user IS the owner of their own stream.
//   * Reply (parentId non-null): any logged-in provisioned user.
//   * Delete: author / log-stream owner / admin (assertLogMutable in helper).
//
// Invariants:
//   * Snowflake ids are STRINGS end-to-end (never Number()/parseInt).
//   * Body is PLAIN TEXT: trimmed, non-empty, max 500 chars.
//   * sendOk/sendError from helpers/response (shared { success, data } envelope).
// Side effects: DB reads/writes via log helpers; pool acquired per request.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { optionalAuth } from '../../middlewares/optionalAuth';
import { sendOk, sendError } from '../../helpers/response';
import {
    createLog,
    softDeleteLog,
    listLogStream,
    listLogGlobalStream,
    listLogThread,
    LogParentError,
    LogForbiddenError,
    LogNotFoundError,
} from '../../helpers/log';
import type { TLogCreateRequest } from '@repo/types';

const MAX_BODY_LENGTH = 500;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
// Stream cursor sentinel: max int8 so the first page starts at the newest.
const CURSOR_SENTINEL = '9223372036854775807';
// Child cursor sentinel: max int8 so newest-first reply paging starts at the
// newest (keyset pages backward via id < cursor).
const CHILD_CURSOR_SENTINEL = '9223372036854775807';

// Clamp the requested page size to [1, MAX_PAGE_LIMIT], defaulting when absent
// or invalid. Pure function: explicit in/out, no IO.
function clampPageLimit(raw?: string): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_LIMIT;
    return Math.min(n, MAX_PAGE_LIMIT);
}

// Reject anything that is not a non-empty digit string — prevents a malformed
// BIGINT from reaching node-pg and causing a 500.
function isValidId(value: string): boolean {
    return /^\d+$/.test(value);
}

export const logRouter = Router();

// GET /thread/:id — focus-node view.
// Registered BEFORE /:username so the literal "thread" segment is not captured
// as a username parameter.
logRouter.get('/thread/:id', optionalAuth, async (req, res) => {
    try {
        const focusId = String(req.params.id);
        if (!isValidId(focusId)) {
            sendError(res, 400, 'invalid log id');
            return;
        }

        const rawChildCursor =
            typeof req.query.childCursor === 'string'
                ? req.query.childCursor
                : '';
        const childCursor = isValidId(rawChildCursor)
            ? rawChildCursor
            : CHILD_CURSOR_SENTINEL;
        const childLimit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const result = await listLogThread(pool, focusId, {
            cursor: childCursor,
            limit: childLimit,
        });
        if (result === null) {
            sendError(res, 404, 'log node not found');
            return;
        }
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log/thread/:id error:', error);
        sendError(res, 500, 'failed to load log thread');
    }
});

// GET / — global stream across ALL users (the /log discovery feed).
// Registered BEFORE /:username. A bare path and a single segment do not
// collide, but keeping global-first documents intent.
logRouter.get('/', optionalAuth, async (req, res) => {
    try {
        const rawCursor =
            typeof req.query.cursor === 'string' ? req.query.cursor : '';
        const cursor = isValidId(rawCursor) ? rawCursor : CURSOR_SENTINEL;
        const limit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const result = await listLogGlobalStream(pool, { cursor, limit });
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log error:', error);
        sendError(res, 500, 'failed to load global log stream');
    }
});

// GET /:username — top-level stream for a user (newest-first keyset).
logRouter.get('/:username', optionalAuth, async (req, res) => {
    try {
        const username = String(req.params.username);

        const rawCursor =
            typeof req.query.cursor === 'string' ? req.query.cursor : '';
        const cursor = isValidId(rawCursor) ? rawCursor : CURSOR_SENTINEL;
        const limit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const result = await listLogStream(pool, username, { cursor, limit });
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log/:username error:', error);
        sendError(res, 500, 'failed to load log stream');
    }
});

// POST / — create a top-level log post or a reply.
// Top-level (parentId=null): owner-only — the caller must have a username (i.e.
// be a provisioned account that owns a stream). requireAuth already ensures
// provisioning, so the extra guard checks req.auth.username is non-null.
// Reply (parentId non-null): any requireAuth-provisioned user.
logRouter.post('/', requireAuth, async (req, res) => {
    try {
        const input = req.body as TLogCreateRequest;
        const body = typeof input.body === 'string' ? input.body.trim() : '';
        if (body.length === 0) {
            sendError(res, 400, 'body is required');
            return;
        }
        if (body.length > MAX_BODY_LENGTH) {
            sendError(res, 400, 'body is too long');
            return;
        }

        const rawParentId = input.parentId;
        const parentId =
            typeof rawParentId === 'string' && rawParentId.length > 0
                ? rawParentId
                : null;

        if (parentId !== null && !isValidId(parentId)) {
            sendError(res, 400, 'invalid parent id');
            return;
        }

        // Owner-only guard for top-level posts: a provisioned user without a
        // username cannot own a stream; return 403 (spec: "parentId=null →
        // OWNER-ONLY 403 else").
        if (parentId === null && req.auth!.username === null) {
            sendError(
                res,
                403,
                'you must have a username to post a top-level log'
            );
            return;
        }

        const log = await createLog(pool, req.auth!.userId, parentId, body);
        sendOk(res, log, 201);
    } catch (error) {
        if (error instanceof LogParentError) {
            sendError(res, 400, error.message);
            return;
        }
        console.error('POST /api/log error:', error);
        sendError(res, 500, 'failed to create log entry');
    }
});

// DELETE /:id — soft-delete a log node (tombstone; body retained in DB).
logRouter.delete('/:id', requireAuth, async (req, res) => {
    try {
        const logId = String(req.params.id);
        if (!isValidId(logId)) {
            sendError(res, 400, 'invalid log id');
            return;
        }

        const log = await softDeleteLog(
            pool,
            logId,
            req.auth!.userId,
            req.auth!.isAdmin
        );
        sendOk(res, log);
    } catch (error) {
        if (error instanceof LogNotFoundError) {
            sendError(res, 404, error.message);
            return;
        }
        if (error instanceof LogForbiddenError) {
            sendError(res, 403, error.message);
            return;
        }
        console.error('DELETE /api/log/:id error:', error);
        sendError(res, 500, 'failed to delete log entry');
    }
});
