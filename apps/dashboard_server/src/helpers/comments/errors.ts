// Purpose: shared primitives for the threaded-comment service (Option C) — the
//          typed error classes plus the pure row→wire mapper used by both the
//          read (list) and write (create/delete/update) paths.
// Invariants:
//   * ids are Snowflake BIGINT — kept as STRINGS end-to-end (node-pg returns
//     int8 as a string; never Number()-ed, which truncates past MAX_SAFE_INTEGER).
//   * Tombstone read-mask: a deleted comment exposes body '[deleted]',
//     isDeleted=true, and drops the author name (masking done in SQL upstream).
// Side effects: none — toComment is a pure function; the classes are stateless.
import type { Pool, PoolClient } from 'pg';
import type { TComment } from '@repo/types';

export type TDb = Pool | PoolClient;

// A row from the comment-tree read. Snowflake ids stay strings; path is a
// string[] of those ids; is_deleted/author_name are projected per Rule 2.
export interface TCommentRow {
    id: string;
    post_id: string;
    user_id: string;
    parent_id: string | null;
    path: string[];
    depth: string;
    body: string;
    is_deleted: boolean;
    author_name: string | null;
    created_at: string;
    updated_at: string;
}

export class CommentParentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentParentError';
    }
}

export class CommentForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentForbiddenError';
    }
}

export class CommentNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentNotFoundError';
    }
}

// Raised when an edit targets a tombstoned comment (deleted_at IS NOT NULL).
// The row exists, so this is NOT a 404 — the route maps it to 409 (conflict):
// the resource state forbids the mutation. body of a tombstone is immutable.
export class CommentDeletedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommentDeletedError';
    }
}

// Map a read row to the wire shape. Tombstoned rows expose body '[deleted]'
// (masked in SQL) and drop the author name (authorName omitted).
export function toComment(row: TCommentRow): TComment {
    const base: TComment = {
        id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        parentId: row.parent_id === null ? null : String(row.parent_id),
        path: row.path.map(String),
        depth: Number(row.depth),
        body: row.body,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
    if (!row.is_deleted && row.author_name) {
        base.authorName = row.author_name;
    }
    return base;
}
