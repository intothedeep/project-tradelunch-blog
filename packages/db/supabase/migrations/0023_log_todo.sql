-- =============================================================================
-- Migration: 0023_log_todo.sql
-- Purpose   : Log-as-todo support (Phase Y-TD). Adds opt-in todo tracking to
--             the `log` table via two nullable TIMESTAMPTZ columns:
--               due_at  — presence signals "this log is a todo" (no is_todo flag).
--               done_at — set when the owner marks the todo complete.
--             Status is DERIVED, not stored:
--               done_at IS NOT NULL            → 'done'   (done wins over overdue)
--               due_at IS NULL                 → not a todo (status undefined)
--               due_at < now() AND done_at NULL → 'overdue'
--               else                           → 'todo'
--             Mirrors helpers/log/status.ts deriveLogStatus and the SQL CASE
--             in ROW_PROJECTION_TODO (cross-referenced in list.ts).
-- Source    : packages/db/supabase/migrations/0023_log_todo.sql (authoritative).
--             DDL block mirrored in packages/db/schema/tradelunch.schema.sql
--             (log block, after the 0022 indexes).
-- Contract  : @repo/types (TLogTodoStatus, TLog.dueAt/doneAt/todoStatus,
--             TLogTodoUpdateRequest, TLogTodoListResponse).
-- Privacy   : todo fields are OWNER-PRIVATE — omitted from any response where
--             the requesting viewer ≠ the log's owner.
-- Note      : Additive + idempotent (IF NOT EXISTS). Soft-delete respected:
--             the partial index filters deleted_at IS NULL. BIGINT ids are
--             STRINGS end-to-end.
-- =============================================================================

ALTER TABLE log ADD COLUMN IF NOT EXISTS due_at  TIMESTAMPTZ NULL;
ALTER TABLE log ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ NULL;

-- Partial index for the open-todo query: owner + upcoming due, skips done + deleted.
CREATE INDEX IF NOT EXISTS idx_log_todo_open
    ON log (user_id, due_at)
    WHERE due_at IS NOT NULL AND done_at IS NULL AND deleted_at IS NULL;
