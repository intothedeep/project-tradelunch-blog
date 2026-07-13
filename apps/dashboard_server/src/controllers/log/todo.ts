// Purpose: Todo-extension routes for the Log micro-feed (Phase Y-TD).
//   PATCH /:id/todo  — set/clear due_at and/or mark done/reopen (author-only).
//   GET   /todos     — list the owner's todos with status filter + keyset cursor.
//
// Privacy invariant: todo fields (dueAt/doneAt/todoStatus) are OWNER-PRIVATE.
//   Only the log's author (log.user_id === req.auth.userId) receives those fields.
//   For all other viewers the fields are absent from the DTO (not null — absent).
//
// Feature-guard: if migration 0023 has not been applied (due_at column absent),
//   isTodoFeatureReady returns false and both endpoints return inert responses
//   (empty list / 503 feature-off). This keeps the existing 227-test suite green.
//
// Invariants:
//   * requireAuth on every route — no anonymous access.
//   * BIGINT ids are STRINGS end-to-end (never Number()/parseInt an id).
//   * sendOk/sendError from helpers/response (shared { success, data } envelope).
//   * Touches only `log` + `users` tables (isolation rule from Phase Y).
// Side effects: DB reads/writes via pool.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { sendOk, sendError } from '../../helpers/response';
import {
    isTodoFeatureReady,
    setTodo,
    markDone,
    reopen,
    listTodos,
} from '../../helpers/log/todo';
import type { TLogTodoUpdateRequest } from '@repo/types';

// Re-use the same page-limit constants and helpers defined in the log controller.
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const TODO_CURSOR_DEFAULT = '';

function clampPageLimit(raw?: string): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_LIMIT;
    return Math.min(n, MAX_PAGE_LIMIT);
}

function isValidId(value: string): boolean {
    return /^\d+$/.test(value);
}

export const logTodoRouter = Router();

// PATCH /:id/todo — set or clear due_at, and/or mark done/reopen.
// Author-only: caller must be the log node's user_id (403 otherwise).
// Accepts TLogTodoUpdateRequest: { dueAt?: string|null; done?: boolean }.
//   dueAt: undefined=unchanged, null=clear todo, string=set/update due date.
//   done:  undefined=unchanged, true=markDone, false=reopen.
// Returns the updated TLog with todo fields (owner context).
logTodoRouter.patch('/:id/todo', requireAuth, async (req, res) => {
    try {
        if (!(await isTodoFeatureReady(pool))) {
            sendError(
                res,
                503,
                'todo feature not available (migration pending)'
            );
            return;
        }

        const logId = String(req.params.id);
        if (!isValidId(logId)) {
            sendError(res, 400, 'invalid log id');
            return;
        }

        const input = req.body as TLogTodoUpdateRequest;
        const callerId = req.auth!.userId;

        // Verify authorship: load the log's user_id before mutating.
        const { rows: ownerRows } = await pool.query<{
            user_id: string;
            deleted_at: string | null;
        }>(`SELECT user_id, deleted_at FROM log WHERE id = $1`, [logId]);
        if (ownerRows.length === 0) {
            sendError(res, 404, 'log node not found');
            return;
        }
        const logRow = ownerRows[0]!;
        if (logRow.deleted_at !== null) {
            sendError(res, 410, 'log node has been deleted');
            return;
        }
        if (String(logRow.user_id) !== String(callerId)) {
            sendError(res, 403, 'only the author may update todo state');
            return;
        }

        // Apply tri-state due_at mutation when provided.
        if (input.dueAt !== undefined) {
            const result = await setTodo(pool, logId, callerId, input.dueAt);
            if (result === null) {
                sendError(res, 404, 'log node not found');
                return;
            }
            // If done flag is also set, apply it as a second operation.
            if (input.done === true) {
                const doneResult = await markDone(pool, logId, callerId);
                sendOk(res, doneResult ?? result);
                return;
            }
            if (input.done === false) {
                const reopenResult = await reopen(pool, logId, callerId);
                sendOk(res, reopenResult ?? result);
                return;
            }
            sendOk(res, result);
            return;
        }

        // Only done flag provided (no due_at change).
        if (input.done === true) {
            const result = await markDone(pool, logId, callerId);
            if (result === null) {
                sendError(
                    res,
                    422,
                    'log node has no due date; set due_at first'
                );
                return;
            }
            sendOk(res, result);
            return;
        }
        if (input.done === false) {
            const result = await reopen(pool, logId, callerId);
            if (result === null) {
                sendError(res, 422, 'log node has no due date or is not done');
                return;
            }
            sendOk(res, result);
            return;
        }

        // Nothing to update.
        sendError(
            res,
            400,
            'no update fields provided (dueAt or done required)'
        );
    } catch (error) {
        console.error('PATCH /api/log/:id/todo error:', error);
        sendError(res, 500, 'failed to update todo state');
    }
});

// GET /todos — owner's todo list, filtered by status, keyset-paginated.
// Query params:
//   status: 'todo' | 'done' | 'overdue' | 'all'  (default: 'all')
//   cursor: compound "<due_at_iso>|<id>" string   (default: '' = start)
//   limit:  number [1..100]                       (default: 50)
// Response: TLogTodoListResponse { items, counts, nextCursor, hasMore }
logTodoRouter.get('/todos', requireAuth, async (req, res) => {
    try {
        if (!(await isTodoFeatureReady(pool))) {
            sendOk(res, {
                items: [],
                counts: { todo: 0, overdue: 0, done: 0 },
                nextCursor: null,
                hasMore: false,
            });
            return;
        }

        const callerId = req.auth!.userId;
        const rawStatus =
            typeof req.query.status === 'string' ? req.query.status : 'all';
        const status = ['todo', 'done', 'overdue', 'all'].includes(rawStatus)
            ? rawStatus
            : 'all';

        const cursor =
            typeof req.query.cursor === 'string'
                ? req.query.cursor
                : TODO_CURSOR_DEFAULT;
        const limit = clampPageLimit(
            typeof req.query.limit === 'string' ? req.query.limit : undefined
        );

        const result = await listTodos(pool, callerId, {
            status,
            cursor,
            limit,
        });
        sendOk(res, result);
    } catch (error) {
        console.error('GET /api/log/todos error:', error);
        sendError(res, 500, 'failed to load todos');
    }
});
