// Purpose: read path for threaded comments (Option C — stored BIGINT[]
//          materialized path).
//   * listCommentTree returns the WHOLE thread in pre-order DFS via a plain
//     `WHERE post_id=$1 ORDER BY path` (NO recursive CTE).
//   * listCommentPage returns ONE page of 50 ROOT comments (newest-first), each
//     with its FULL descendant subtree (replies never orphan, never count toward
//     the 50). Keyset cursor = the last ROOT id (string); mirrors posts.ts.
// Invariants:
//   * Isolation: every statement touches the `comments` table (joined to users
//     for the author name) only — it NEVER reads posts.parent_id/group_id/level.
//   * Tombstones are RETURNED (subtree survives) with body masked to '[deleted]'
//     and author nulled; the original body never leaves the DB.
//   * ids/cursor are STRINGS end-to-end (Snowflake precision); the bigint[] page
//     param is bound from string root ids (node-pg accepts string elements).
//   * A fully-dead root (deleted, no live descendant) is EXCLUDED from the page;
//     a tombstoned root WITH a live reply still appears (masked at read).
// Side effects: SELECTs only.
import type { TComment } from '@repo/types';
import { type TDb, type TCommentRow, toComment } from './errors';

// The shared row projection used by BOTH the full-tree read and the paged read:
// same join to users, same '[deleted]' masking, same depth = cardinality - 1.
const ROW_PROJECTION = `
    c.id,
    c.post_id,
    c.user_id,
    c.parent_id,
    c.path,
    cardinality(c.path) - 1                                    AS depth,
    CASE WHEN c.deleted_at IS NOT NULL
         THEN '[deleted]' ELSE c.body END                     AS body,
    (c.deleted_at IS NOT NULL)                                AS is_deleted,
    CASE WHEN c.deleted_at IS NOT NULL THEN NULL
         ELSE COALESCE(u.display_name, u.username) END        AS author_name,
    c.created_at,
    c.updated_at`;

// Read the entire comment thread for a post in pre-order DFS. No recursive CTE:
// the stored BIGINT[] path sorts element-wise, so ORDER BY path IS the tree
// order (served by idx_comments_post_path). Tombstones are RETURNED (subtree
// survives) with body masked to '[deleted]' and author nulled.
export async function listCommentTree(
    db: TDb,
    postId: string
): Promise<TComment[]> {
    const { rows } = await db.query<TCommentRow>(
        `SELECT${ROW_PROJECTION}
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = $1
         ORDER BY c.path`,
        [postId]
    );
    return rows.map(toComment);
}

// Pure (no IO): regroup stage-2 subtree rows so roots appear in stage-1 order
// (newest-first) and, within each root, rows keep their pre-order DFS (path)
// order. Each stage-2 row is path-sorted from SQL, so grouping by path[1] then
// concatenating groups in rootIds order yields the full ordered page.
export function orderByRoots<T extends { path: string[] }>(
    rows: T[],
    rootIds: string[]
): T[] {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const root = row.path[0];
        if (root === undefined) continue;
        const group = groups.get(root);
        if (group) group.push(row);
        else groups.set(root, [row]);
    }
    const ordered: T[] = [];
    for (const rootId of rootIds) {
        const group = groups.get(rootId);
        if (group) ordered.push(...group);
    }
    return ordered;
}

// One keyset page of ROOT comments (newest-first), each with its FULL subtree.
// STAGE 1 picks the page of root ids (limit+1 to detect hasMore); STAGE 2 fetches
// every descendant of the kept roots; orderByRoots stitches them deterministically.
export async function listCommentPage(
    db: TDb,
    postId: string,
    opts: { cursor: string; limit: number }
): Promise<{
    comments: TComment[];
    nextCursor: string | null;
    hasMore: boolean;
}> {
    const { cursor, limit } = opts;

    // STAGE 1 — pick the page of root ids (newest-first, keyset on id < cursor).
    // A root tombstone with NO live descendant is excluded; one WITH a live
    // reply survives (masked downstream). Fetch limit+1 to detect hasMore.
    const { rows: rootRows } = await db.query<{ id: string }>(
        `SELECT c.id
         FROM comments c
         WHERE c.post_id = $1
           AND c.parent_id IS NULL
           AND c.id < $2
           AND ( c.deleted_at IS NULL
                 OR EXISTS (
                     SELECT 1 FROM comments d
                     WHERE d.post_id = $1
                       AND d.path[1] = c.id
                       AND d.deleted_at IS NULL ) )
         ORDER BY c.id DESC
         LIMIT $3`,
        [postId, cursor, limit + 1]
    );

    const hasMore = rootRows.length > limit;
    const keptRoots = hasMore ? rootRows.slice(0, limit) : rootRows;
    const rootIds = keptRoots.map((r) => String(r.id));

    if (rootIds.length === 0) {
        return { comments: [], nextCursor: null, hasMore: false };
    }

    const nextCursor = hasMore ? rootIds[rootIds.length - 1]! : null;

    // STAGE 2 — full subtrees for the kept roots, projected EXACTLY like
    // listCommentTree (same users join, same toComment mapper incl. updatedAt,
    // same '[deleted]' masking). bigint[] bound from the string root ids.
    const { rows: subtreeRows } = await db.query<TCommentRow>(
        `SELECT${ROW_PROJECTION}
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = $1
           AND c.path[1] = ANY($2::bigint[])
         ORDER BY c.path`,
        [postId, rootIds]
    );

    const comments = orderByRoots(subtreeRows, rootIds).map(toComment);
    return { comments, nextCursor, hasMore };
}
