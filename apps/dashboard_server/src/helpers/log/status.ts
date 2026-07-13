// Purpose: Pure functional-core helper that derives the todo status of a Log
//          node from its due_at and done_at values.
// This function is the TypeScript mirror of the SQL CASE expression used in
// ROW_PROJECTION_TODO (helpers/log/todo.ts):
//   CASE WHEN done_at IS NOT NULL     THEN 'done'
//        WHEN due_at IS NULL          THEN NULL
//        WHEN due_at < now()          THEN 'overdue'
//        ELSE                              'todo'
//   END
// Keep both in sync: if the SQL CASE changes, update this function and vice-versa.
//
// Invariants:
//   * No DB reads, no clock reads. `now` is INJECTED for determinism + testability.
//   * done wins over overdue (done_at presence checked first).
//   * Returns undefined (not a string) when due_at is null (= not a todo).
//   * Accepts ISO strings or Date objects — coerces internally.
// Side effects: none.
import type { TLogTodoStatus } from '@repo/types';

export function deriveLogStatus(
    dueAt: Date | string | null,
    doneAt: Date | string | null,
    now: Date
): TLogTodoStatus | undefined {
    // done wins over overdue — check completion first.
    if (doneAt !== null && doneAt !== undefined) return 'done';
    // No due date → not a todo.
    if (dueAt === null || dueAt === undefined) return undefined;
    // Convert string → Date for comparison.
    const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
    // Past due date (strict less-than; due == now is still 'todo').
    if (due < now) return 'overdue';
    return 'todo';
}
