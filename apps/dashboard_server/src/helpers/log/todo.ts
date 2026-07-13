// Purpose: Todo-extension helpers for the Log micro-feed (Phase Y-TD).
// All helpers are owner-scoped (never touch another user's todo state).
// Invariants:
//   * Feature-guard: probes information_schema.columns once at first call;
//     caches a boolean. When due_at column is absent (migration 0023 not yet
//     applied), all public functions return inert results so the existing
//     suite stays green.
//   * BIGINT ids are STRINGS end-to-end (never Number()/parseInt).
//   * Soft-delete respected: reads always mask deleted_at IS NOT NULL rows.
//   * Todo status is DERIVED, never stored (mirrors deriveLogStatus in status.ts
//     and the SQL CASE in TODO_STATUS_CASE below — keep both in sync).
//   * Isolation: touches only `log` and `users` tables.
// Side effects: DB reads/writes via the injected TDb handle.
import type { Pool } from 'pg';
import type { TLog, TLogTodoStatus, TLogTodoListResponse } from '@repo/types';
import { type TDb, type TLogRow, toLog } from './errors';

// ---------------------------------------------------------------------------
// Presence guard — boot-time probe cached after first resolution.
// ---------------------------------------------------------------------------

let _featureReady: boolean | null = null;

// Probe information_schema.columns for due_at. Cached after first call.
export async function isTodoFeatureReady(db: TDb): Promise<boolean> {
    if (_featureReady !== null) return _featureReady;
    try {
        const { rows } = await db.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'log' AND column_name = 'due_at'
             ) AS exists`
        );
        _featureReady = rows[0]?.exists ?? false;
    } catch {
        return false; // retry on next request (_featureReady stays null)
    }
    return _featureReady;
}

// Reset for testing only.
export function _resetTodoFeatureCache(): void {
    _featureReady = null;
}

// ---------------------------------------------------------------------------
// Shared SQL fragments.
// ---------------------------------------------------------------------------

// Mirrors deriveLogStatus exactly. If this CASE changes, update status.ts too.
const TODO_STATUS_CASE = `
    CASE
        WHEN l.done_at IS NOT NULL THEN 'done'
        WHEN l.due_at  IS NULL     THEN NULL
        WHEN l.due_at  < now()     THEN 'overdue'
        ELSE 'todo'
    END`;

// RETURNING clause for UPDATE ... FROM users on log rows with todo columns.
const TODO_RETURNING = `
    RETURNING
        l.id, l.user_id, l.parent_id, l.path,
        cardinality(l.path) - 1                              AS depth,
        l.body,
        false                                                AS is_deleted,
        COALESCE(u.display_name, u.username)                 AS author_name,
        u.username                                           AS author_username,
        u.avatar_url                                         AS author_avatar_url,
        l.created_at, l.due_at, l.done_at,
        ${TODO_STATUS_CASE}                                  AS todo_status`;

// ---------------------------------------------------------------------------
// Row shapes and mappers.
// ---------------------------------------------------------------------------

interface TLogTodoRow extends TLogRow {
    due_at: string | null;
    done_at: string | null;
    todo_status: TLogTodoStatus | null;
}

// Build a TLog from a todo row. Attaches todo fields when due_at is set.
// OWNER context assumed — caller must only pass rows where viewer = owner.
function toLogWithTodo(row: TLogTodoRow): TLog {
    const base = toLog(row);
    if (row.due_at !== null) {
        base.dueAt = row.due_at;
        base.doneAt = row.done_at;
        base.todoStatus = row.todo_status ?? undefined;
    }
    return base;
}

// ---------------------------------------------------------------------------
// Compound cursor: "<due_at_iso>|<id>" for (due_at ASC, id ASC) keyset.
// ---------------------------------------------------------------------------

const TODO_CURSOR_SENTINEL = '';

function encodeTodoCursor(dueAt: string, id: string): string {
    return `${dueAt}|${id}`;
}

function decodeTodoCursor(
    cursor: string
): { dueAt: string; id: string } | null {
    if (!cursor) return null;
    const idx = cursor.indexOf('|');
    if (idx < 1) return null;
    const dueAt = cursor.slice(0, idx);
    const id = cursor.slice(idx + 1);
    if (!id || !/^\d+$/.test(id)) return null;
    return { dueAt, id };
}

// ---------------------------------------------------------------------------
// Write helpers (owner-scoped).
// ---------------------------------------------------------------------------

// Set or clear due_at. dueAt=null removes the todo marker; string sets/updates.
export async function setTodo(
    db: TDb,
    logId: string,
    userId: number,
    dueAt: string | null
): Promise<TLog | null> {
    const { rows } = await db.query<TLogTodoRow>(
        `UPDATE log l SET due_at = $1
         FROM users u
         WHERE l.id = $2 AND l.user_id = $3
           AND l.deleted_at IS NULL AND u.id = l.user_id
         ${TODO_RETURNING}`,
        [dueAt, logId, userId]
    );
    return rows[0] ? toLogWithTodo(rows[0]) : null;
}

// Mark done (sets done_at = now()). Requires due_at to be set. Owner-only.
export async function markDone(
    db: TDb,
    logId: string,
    userId: number
): Promise<TLog | null> {
    const { rows } = await db.query<TLogTodoRow>(
        `UPDATE log l SET done_at = now()
         FROM users u
         WHERE l.id = $1 AND l.user_id = $2
           AND l.due_at IS NOT NULL AND l.deleted_at IS NULL
           AND u.id = l.user_id
         ${TODO_RETURNING}`,
        [logId, userId]
    );
    return rows[0] ? toLogWithTodo(rows[0]) : null;
}

// Reopen a todo (clears done_at). Requires due_at to be set. Owner-only.
export async function reopen(
    db: TDb,
    logId: string,
    userId: number
): Promise<TLog | null> {
    const { rows } = await db.query<TLogTodoRow>(
        `UPDATE log l SET done_at = NULL
         FROM users u
         WHERE l.id = $1 AND l.user_id = $2
           AND l.due_at IS NOT NULL AND l.deleted_at IS NULL
           AND u.id = l.user_id
         ${TODO_RETURNING}`,
        [logId, userId]
    );
    return rows[0] ? toLogWithTodo(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Read helpers.
// ---------------------------------------------------------------------------

// Aggregate todo/overdue/done counts for the owner in a single query.
export async function countTodos(
    db: TDb,
    userId: number
): Promise<{ todo: number; overdue: number; done: number }> {
    const { rows } = await db.query<{
        todo: string;
        overdue: string;
        done: string;
    }>(
        `SELECT
             COUNT(*) FILTER (WHERE done_at IS NULL AND due_at >= now())::text AS todo,
             COUNT(*) FILTER (WHERE done_at IS NULL AND due_at  < now())::text AS overdue,
             COUNT(*) FILTER (WHERE done_at IS NOT NULL)::text                 AS done
         FROM log
         WHERE user_id = $1 AND due_at IS NOT NULL AND deleted_at IS NULL`,
        [userId]
    );
    const row = rows[0];
    return {
        todo: Number(row?.todo ?? 0),
        overdue: Number(row?.overdue ?? 0),
        done: Number(row?.done ?? 0),
    };
}

// List todos for an owner: status filter + (due_at ASC, id ASC) keyset.
// status: 'todo' | 'done' | 'overdue' | 'all'.  limit clamped by caller.
export async function listTodos(
    db: Pool,
    userId: number,
    opts: { status: string; cursor: string; limit: number }
): Promise<TLogTodoListResponse> {
    const { status, cursor, limit } = opts;
    const decoded = decodeTodoCursor(cursor);

    const statusFilter =
        status === 'todo'
            ? `AND l.done_at IS NULL AND l.due_at >= now()`
            : status === 'overdue'
              ? `AND l.done_at IS NULL AND l.due_at  < now()`
              : status === 'done'
                ? `AND l.done_at IS NOT NULL`
                : '';

    // Keyset filter when a cursor is present.
    const keysetFilter = decoded
        ? `AND (l.due_at > $4 OR (l.due_at = $4 AND l.id > $5::bigint))`
        : '';

    const params: (string | number)[] = decoded
        ? [userId, limit + 1, status, decoded.dueAt, decoded.id]
        : [userId, limit + 1, status];

    const { rows } = await db.query<TLogTodoRow>(
        `SELECT
             l.id, l.user_id, l.parent_id, l.path,
             cardinality(l.path) - 1                               AS depth,
             CASE WHEN l.deleted_at IS NOT NULL THEN '[deleted]'
                  ELSE l.body END                                  AS body,
             (l.deleted_at IS NOT NULL)                            AS is_deleted,
             CASE WHEN l.deleted_at IS NOT NULL THEN NULL
                  ELSE COALESCE(u.display_name, u.username) END    AS author_name,
             CASE WHEN l.deleted_at IS NOT NULL THEN NULL
                  ELSE u.username END                              AS author_username,
             CASE WHEN l.deleted_at IS NOT NULL THEN NULL
                  ELSE u.avatar_url END                            AS author_avatar_url,
             l.created_at, l.due_at, l.done_at,
             ${TODO_STATUS_CASE}                                   AS todo_status
         FROM log l
         JOIN users u ON u.id = l.user_id
         WHERE l.user_id = $1 AND l.due_at IS NOT NULL AND l.deleted_at IS NULL
           ${statusFilter}
           ${keysetFilter}
         ORDER BY l.due_at ASC, l.id ASC
         LIMIT $2`,
        params
    );

    const counts = await countTodos(db, userId);
    const hasMore = rows.length > limit;
    const kept = hasMore ? rows.slice(0, limit) : rows;
    const items = kept.map(toLogWithTodo);
    const lastRow = kept[kept.length - 1];
    const nextCursor =
        hasMore && lastRow?.due_at
            ? encodeTodoCursor(lastRow.due_at, String(lastRow.id))
            : null;

    return { items, counts, nextCursor, hasMore };
}

export { TODO_CURSOR_SENTINEL };
