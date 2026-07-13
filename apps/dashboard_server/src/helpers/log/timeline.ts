// Purpose: viewer-scoped timeline for the Log micro-feed (Phase Y-M2).
//   Fan-in of TOP-LEVEL log nodes from users that the viewer follows,
//   ordered newest-first (id DESC), keyset-paginated. Enriches each row
//   with like_count and viewer_liked when log_likes table exists.
// Invariants:
//   * Feature-guard: probes to_regclass('public.follows') at first call;
//     returns empty timeline when absent (migration 0024 not yet applied).
//   * BIGINT ids are STRINGS end-to-end (never Number()/parseInt).
//   * Only touches log, users, follows, and log_likes tables.
//   * Reuses ROW_PROJECTION idiom from list.ts; like columns added conditionally.
// Side effects: SELECTs only.
import type { Pool } from 'pg';
import type { TLog, TLogTimelineResponse } from '@repo/types';
import { type TLogRow, toLog } from './errors';
import { isLogLikesReady } from './likes';
import { isFollowsReady, listFolloweeIds } from '../follows';

// Shared cursor sentinel: max int8 so the first page starts at the newest node.
export const TIMELINE_CURSOR_SENTINEL = '9223372036854775807';

// Base projection (same masking as list.ts ROW_PROJECTION).
const BASE_PROJECTION = `
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
    CASE WHEN l.deleted_at IS NOT NULL THEN NULL
         ELSE u.avatar_url END                                 AS author_avatar_url,
    l.created_at`;

// Extended row shape when like columns are included.
interface TLogRowWithLikes extends TLogRow {
    like_count: string;
    viewer_liked: boolean;
}

// Map an extended row to TLog, attaching social fields when present.
function toLogWithLikes(row: TLogRowWithLikes | TLogRow): TLog {
    const node = toLog(row as TLogRow);
    const extended = row as TLogRowWithLikes;
    if (extended.like_count !== undefined) {
        node.likeCount = Number(extended.like_count);
        node.viewerLiked = extended.viewer_liked ?? false;
    }
    return node;
}

// One keyset page of top-level log nodes from users followed by viewerId,
// newest-first. cursor = last returned id string (sentinel = max int8).
// limit is clamped [1..100] by the caller.
export async function listLogTimeline(
    db: Pool,
    viewerId: number,
    cursor: string,
    limit: number
): Promise<TLogTimelineResponse> {
    // Short-circuit when follows table is absent.
    if (!(await isFollowsReady(db))) {
        return { items: [], nextCursor: null, hasMore: false };
    }

    // Resolve the set of followed user ids for the viewer.
    const followeeIds = await listFolloweeIds(db, viewerId);
    if (followeeIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
    }

    const likesReady = await isLogLikesReady(db);

    let rows: (TLogRowWithLikes | TLogRow)[];

    if (likesReady) {
        // Include correlated like_count + viewer_liked subselects.
        const result = await db.query<TLogRowWithLikes>(
            `SELECT${BASE_PROJECTION},
                (SELECT COUNT(*)::text FROM log_likes ll WHERE ll.log_id = l.id) AS like_count,
                EXISTS (
                    SELECT 1 FROM log_likes ll
                    WHERE ll.log_id = l.id AND ll.user_id = $3
                ) AS viewer_liked
             FROM log l
             JOIN users u ON u.id = l.user_id
             WHERE l.user_id = ANY($1::bigint[])
               AND l.parent_id IS NULL
               AND l.id < $2
             ORDER BY l.id DESC
             LIMIT $4`,
            [followeeIds, cursor, viewerId, limit + 1]
        );
        rows = result.rows;
    } else {
        const result = await db.query<TLogRow>(
            `SELECT${BASE_PROJECTION}
             FROM log l
             JOIN users u ON u.id = l.user_id
             WHERE l.user_id = ANY($1::bigint[])
               AND l.parent_id IS NULL
               AND l.id < $2
             ORDER BY l.id DESC
             LIMIT $3`,
            [followeeIds, cursor, limit + 1]
        );
        rows = result.rows;
    }

    const hasMore = rows.length > limit;
    const kept = hasMore ? rows.slice(0, limit) : rows;
    const items = kept.map(toLogWithLikes);
    const nextCursor = hasMore ? String(kept[kept.length - 1]!.id) : null;

    return { items, nextCursor, hasMore };
}
