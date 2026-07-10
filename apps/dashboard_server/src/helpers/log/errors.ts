// Purpose: shared primitives for the Log micro-feed service (Phase Y) — typed
//          error classes plus the pure row→wire mapper used by both the read
//          (list) and write (create/delete) paths.
// Invariants:
//   * ids are Postgres BIGINT IDENTITY — kept as STRINGS end-to-end (node-pg
//     returns int8 as a string; never Number()-ed, which truncates past
//     MAX_SAFE_INTEGER).
//   * Tombstone read-mask: a deleted log node exposes body '[deleted]',
//     isDeleted=true, and drops authorName. Masking done here in toLog().
//   * No cross-import from the comments module — idioms copied verbatim.
// Side effects: none — toLog is a pure function; the classes are stateless.
import type { Pool, PoolClient } from 'pg';
import type { TLog } from '@repo/types';

export type TDb = Pool | PoolClient;

// A row returned from the log table with the joined author name. Snowflake ids
// stay strings; path is a string[] of those ids; is_deleted and author_name are
// projected per the tombstone masking rule.
export interface TLogRow {
    id: string;
    user_id: string;
    parent_id: string | null;
    path: string[];
    depth: string;
    body: string;
    is_deleted: boolean;
    author_name: string | null;
    author_username: string | null;
    created_at: string;
}

// Reply targets a deleted or missing parent log node (400).
export class LogParentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LogParentError';
    }
}

// Caller lacks rights to mutate this log node (403).
export class LogForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LogForbiddenError';
    }
}

// The requested log node does not exist (404).
export class LogNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LogNotFoundError';
    }
}

// Map a DB row to the TLog wire shape. Tombstoned rows expose body '[deleted]'
// and drop authorName. depth is stored as a string by node-pg (int4 from SQL
// expression), so Number() is safe here (it is NOT a BIGINT id).
export function toLog(row: TLogRow): TLog {
    const base: TLog = {
        id: String(row.id),
        userId: String(row.user_id),
        parentId: row.parent_id === null ? null : String(row.parent_id),
        path: row.path.map(String),
        depth: Number(row.depth),
        body: row.body,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
    };
    if (!row.is_deleted && row.author_name) {
        base.authorName = row.author_name;
    }
    if (!row.is_deleted && row.author_username) {
        base.authorUsername = row.author_username;
    }
    return base;
}
