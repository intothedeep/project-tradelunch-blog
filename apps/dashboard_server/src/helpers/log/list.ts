// Purpose: read path for the Log micro-feed (Phase Y — stored BIGINT[]
//          materialized path).
//   * listLogStream returns ONE page of top-level log nodes (parent_id IS NULL)
//     for a given username, newest-first keyset cursor on id.
//   * listLogThread returns the focus-node view: ancestor chain (root→parent,
//     ordered root-first, deleted ancestors masked but present), the focus node
//     itself, and ONE page of depth-1 direct children (newest-first, dead-leaf
//     pruned) each with up to a capped set of depth-2 replies, keyset-paginated.
// Invariants:
//   * Isolation: every statement touches ONLY `log` and `users` — never posts
//     or comments tables.
//   * Tombstones: deleted ancestors are RETURNED (chain must not break), masked
//     with body '[deleted]' and author_name NULL. Dead-leaf children (deleted
//     with no live descendant) are EXCLUDED from the children page.
//   * ids/cursor are STRINGS end-to-end (Snowflake BIGINT precision); never
//     Number()/parseInt any id or cursor value.
//   * Depth-1 children keyset is newest-first (DESC), paging backward via
//     id < cursor — matching the stream feeds' ordering.
// Side effects: SELECTs only.
import type { TLog, TLogStreamResponse, TLogThreadResponse } from '@repo/types';
import { type TDb, type TLogRow, toLog } from './errors';

// Shared SQL projection for log rows: same masking, same join to users.
const ROW_PROJECTION = `
    l.id,
    l.user_id,
    l.parent_id,
    l.path,
    cardinality(l.path) - 1                                    AS depth,
    CASE WHEN l.deleted_at IS NOT NULL
         THEN '[deleted]' ELSE l.body END                      AS body,
    (l.deleted_at IS NOT NULL)                                 AS is_deleted,
    CASE WHEN l.deleted_at IS NOT NULL THEN NULL
         ELSE COALESCE(u.display_name, u.username) END         AS author_name,
    CASE WHEN l.deleted_at IS NOT NULL THEN NULL
         ELSE u.username END                                   AS author_username,
    l.created_at`;

// One keyset page of top-level log nodes for a user, newest-first.
// cursor = last returned id (sentinel = max bigint → start from the newest).
// limit is clamped [1..100] by the caller.
export async function listLogStream(
    db: TDb,
    username: string,
    opts: { cursor: string; limit: number }
): Promise<TLogStreamResponse> {
    const { cursor, limit } = opts;

    // Resolve username → user_id once (lightweight; idx on users.username).
    const { rows: userRows } = await db.query<{ id: string }>(
        `SELECT id FROM users WHERE username = $1`,
        [username]
    );
    const userId = userRows[0]?.id ?? null;
    if (userId === null) {
        return { items: [], nextCursor: null, hasMore: false };
    }

    const { rows } = await db.query<TLogRow>(
        `SELECT${ROW_PROJECTION}
         FROM log l
         JOIN users u ON u.id = l.user_id
         WHERE l.user_id = $1
           AND l.parent_id IS NULL
           AND l.id < $2
         ORDER BY l.id DESC
         LIMIT $3`,
        [userId, cursor, limit + 1]
    );

    const hasMore = rows.length > limit;
    const kept = hasMore ? rows.slice(0, limit) : rows;
    const items = kept.map(toLog);
    const nextCursor = hasMore ? String(kept[kept.length - 1]!.id) : null;

    return { items, nextCursor, hasMore };
}

// Max depth-2 (grandchild) replies eagerly loaded per depth-1 parent in the
// thread view. Beyond this, the reader clicks the depth-1 reply to refocus on it
// and see its full subtree. Bounds page size (depth-1 page × this cap).
const DEPTH2_PER_PARENT_CAP = 3;

// One keyset page of top-level log nodes across ALL users, newest-first.
// The global discovery feed (/log). Same projection/masking as listLogStream
// but WITHOUT the per-user filter. cursor = last returned id (sentinel = max
// bigint → newest first). limit is clamped [1..100] by the caller.
export async function listLogGlobalStream(
    db: TDb,
    opts: { cursor: string; limit: number }
): Promise<TLogStreamResponse> {
    const { cursor, limit } = opts;

    const { rows } = await db.query<TLogRow>(
        `SELECT${ROW_PROJECTION}
         FROM log l
         JOIN users u ON u.id = l.user_id
         WHERE l.parent_id IS NULL
           AND l.id < $1
         ORDER BY l.id DESC
         LIMIT $2`,
        [cursor, limit + 1]
    );

    const hasMore = rows.length > limit;
    const kept = hasMore ? rows.slice(0, limit) : rows;
    const items = kept.map(toLog);
    const nextCursor = hasMore ? String(kept[kept.length - 1]!.id) : null;

    return { items, nextCursor, hasMore };
}

// Focus-node view for a single log node id.
// Returns: ancestors (root→parent, ordered root-first, deleted masked but present),
//          focus (the requested node; masked if deleted; null indicates missing),
//          children — a FLAT pre-order array of depth-1 direct replies AND their
//          depth-2 grandchildren (comment-style 2-level nesting). Each depth-1
//          reply is immediately followed by its (capped) depth-2 children, so the
//          client nests by TLog.depth without a grouping pass. Pagination stays a
//          depth-1 keyset (nextCursor = last depth-1 id); depth-2 is eager-loaded
//          per depth-1 parent up to DEPTH2_PER_PARENT_CAP (refocus for the rest).
// Returns null when the focus id does not exist (404 from the controller).
export async function listLogThread(
    db: TDb,
    focusId: string,
    childOpts: { cursor: string; limit: number }
): Promise<TLogThreadResponse | null> {
    // 1. Load focus node to get its path.
    const { rows: focusRows } = await db.query<TLogRow>(
        `SELECT${ROW_PROJECTION}
         FROM log l
         JOIN users u ON u.id = l.user_id
         WHERE l.id = $1`,
        [focusId]
    );
    if (focusRows.length === 0) return null;
    const focus: TLog = toLog(focusRows[0]!);
    const focusPath = focusRows[0]!.path.map(String);

    // 2. Ancestor chain: path[0..cardinality-2] (exclude focus itself).
    // Deleted ancestors are returned masked (chain must not break).
    // An empty slice means focus is top-level (no ancestors).
    let ancestors: TLog[] = [];
    const ancestorIds = focusPath.slice(0, focusPath.length - 1);
    if (ancestorIds.length > 0) {
        const { rows: ancestorRows } = await db.query<TLogRow>(
            `SELECT${ROW_PROJECTION}
             FROM log l
             JOIN users u ON u.id = l.user_id
             WHERE l.id = ANY($1::bigint[])
             ORDER BY l.path`,
            [ancestorIds]
        );
        ancestors = ancestorRows.map(toLog);
    }

    // 3. Depth-1 children: direct replies to focus, NEWEST-first keyset.
    //    Dead-leaf prune: skip a deleted child UNLESS it has a live descendant.
    //    A node `l` is an ancestor of `d` iff l.id appears in d.path.
    //    We test l.id = ANY(d.path) AND d.id <> l.id (exclude l itself)
    //    so that the EXISTS only fires when l has a live node below it.
    //    cursor = last returned child id (sentinel = max int8 → start newest);
    //    keyset pages backward via l.id < cursor.
    const { cursor: childCursor, limit: childLimit } = childOpts;
    const { rows: childRows } = await db.query<TLogRow>(
        `SELECT${ROW_PROJECTION}
         FROM log l
         JOIN users u ON u.id = l.user_id
         WHERE l.parent_id = $1
           AND l.id < $2
           AND (
               l.deleted_at IS NULL
               OR EXISTS (
                   SELECT 1 FROM log d
                   WHERE l.id = ANY(d.path)
                     AND d.id <> l.id
                     AND d.deleted_at IS NULL
               )
           )
         ORDER BY l.id DESC
         LIMIT $3`,
        [focusId, childCursor, childLimit + 1]
    );

    const childHasMore = childRows.length > childLimit;
    const keptChildren = childHasMore
        ? childRows.slice(0, childLimit)
        : childRows;
    const childNextCursor = childHasMore
        ? String(keptChildren[keptChildren.length - 1]!.id)
        : null;

    // 4. Depth-2 grandchildren: direct replies to the depth-1 nodes in THIS page,
    //    capped per parent (ROW_NUMBER window). Same dead-leaf prune. A masked
    //    depth-1 parent kept in step 3 (deleted but has a live descendant) still
    //    gets its live depth-2 children here — nesting stays coherent.
    // Fetch CAP + 1 per parent so we can DETECT overflow (a parent with more
    // depth-2 replies than the cap) and flag it — the UI shows "see more replies"
    // under that reply. The extra row is trimmed off, never returned.
    const depth1Ids = keptChildren.map((r) => String(r.id));
    const depth2ByParent = new Map<string, TLog[]>();
    const overflowParents = new Set<string>();
    if (depth1Ids.length > 0) {
        const { rows: grandRows } = await db.query<TLogRow>(
            `SELECT id, user_id, parent_id, path, depth, body,
                    is_deleted, author_name, author_username, created_at
             FROM (
                 SELECT${ROW_PROJECTION},
                        ROW_NUMBER() OVER (
                            PARTITION BY l.parent_id ORDER BY l.id DESC
                        ) AS rn
                 FROM log l
                 JOIN users u ON u.id = l.user_id
                 WHERE l.parent_id = ANY($1::bigint[])
                   AND (
                       l.deleted_at IS NULL
                       OR EXISTS (
                           SELECT 1 FROM log d
                           WHERE l.id = ANY(d.path)
                             AND d.id <> l.id
                             AND d.deleted_at IS NULL
                       )
                   )
             ) sub
             WHERE sub.rn <= $2
             ORDER BY sub.parent_id ASC, sub.id DESC`,
            [depth1Ids, DEPTH2_PER_PARENT_CAP + 1]
        );
        // Group raw rows per parent to count, then trim the probe row + flag.
        const rawByParent = new Map<string, TLogRow[]>();
        for (const row of grandRows) {
            const parentId = String(row.parent_id);
            const bucket = rawByParent.get(parentId) ?? [];
            bucket.push(row);
            rawByParent.set(parentId, bucket);
        }
        for (const [parentId, rows] of rawByParent) {
            if (rows.length > DEPTH2_PER_PARENT_CAP) {
                overflowParents.add(parentId);
                rows.length = DEPTH2_PER_PARENT_CAP; // drop the probe row
            }
            depth2ByParent.set(parentId, rows.map(toLog));
        }
    }

    // Flatten to pre-order: each depth-1 reply, then its depth-2 children.
    // A depth-1 reply with trimmed overflow carries hasMoreReplies.
    const childItems: TLog[] = [];
    for (const row of keptChildren) {
        const node = toLog(row);
        if (overflowParents.has(String(row.id))) node.hasMoreReplies = true;
        childItems.push(node);
        const grandchildren = depth2ByParent.get(String(row.id));
        if (grandchildren) childItems.push(...grandchildren);
    }

    return {
        ancestors,
        focus,
        children: {
            items: childItems,
            nextCursor: childNextCursor,
            hasMore: childHasMore,
        },
    };
}
