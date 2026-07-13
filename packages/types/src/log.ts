// ---------------------------------------------------------------------------
// Phase Y — Log: Threads-style personal micro-feed.
// A Log node is immutable after creation (no updatedAt). Soft-delete via
// deleted_at tombstone: isDeleted=true masks body to "[deleted]" at READ and
// clears authorName. BIGINT ids carried as STRINGS end-to-end; never
// Number()/parseInt them. Depth derived as path.length - 1 (never stored).
// ---------------------------------------------------------------------------

// A single Log node (top-level post OR reply — same shape, self-referencing).
export interface TLog {
    // Postgres BIGINT IDENTITY — STRING end-to-end (Snowflake-safe).
    id: string;
    // BIGINT FK → users(id), as STRING.
    userId: string;
    // null for top-level log posts; BIGINT string for replies.
    parentId: string | null;
    // Self-inclusive materialized path: parent.path || id. Strings (BIGINT-safe).
    // Root's path = [id]. Depth = path.length - 1.
    path: string[];
    // Derived depth (path.length - 1). Included for render convenience.
    depth: number;
    // "[deleted]" when isDeleted (tombstone); original body stays in DB only.
    body: string;
    // Soft-delete flag. When true, author fields are omitted and body = "[deleted]".
    isDeleted: boolean;
    // Author DISPLAY label (display_name ?? username) — for rendering only, NOT an
    // identifier (mutable, non-unique). Omitted when isDeleted (masked author).
    authorName?: string;
    // Author's canonical username (users.username) — the stable IDENTIFIER used to
    // build/verify /log/[username] URLs. Omitted when isDeleted (masked author).
    authorUsername?: string;
    // Author avatar URL (users.avatar_url) — often null; the UI falls back to an
    // initial. Omitted when isDeleted (masked author).
    authorAvatarUrl?: string;
    // ISO 8601 timestamp string. No updatedAt — Log nodes are immutable.
    createdAt: string;
    // Thread view only: true on a depth-1 reply that has MORE depth-2 replies
    // than the eager cap — the UI shows a "see more replies" affordance that
    // refocuses on this node. Omitted (undefined) everywhere else.
    hasMoreReplies?: boolean;
    // Phase Y-TD todo fields — OWNER-PRIVATE.
    // Absent entirely (not null) when the viewer is not the log's owner, or
    // when due_at is not set (i.e. this log is not a todo).
    // ISO 8601 string when present.
    dueAt?: string | null;
    doneAt?: string | null;
    todoStatus?: TLogTodoStatus;
    // Phase Y-M2 social fields — present when log_likes table exists.
    // likeCount: live COUNT(*) from log_likes for this node.
    // viewerLiked: whether the authenticated viewer has liked this node.
    //   Absent when the viewer is anonymous.
    likeCount?: number;
    viewerLiked?: boolean;
}

// GET /v1/api/log/:username — top-level stream (newest-first keyset).
// Keyset cursor = last returned top-level id (STRING), null when exhausted.
export interface TLogStreamResponse {
    items: TLog[];
    nextCursor: string | null;
    hasMore: boolean;
}

// GET /v1/api/log/thread/:id — focus-node view.
// ancestors: root→parent chain (ordered root-first, flat, no indent; deleted
//   ancestors are masked but PRESENT — chain must not break).
// focus: the requested Log node (masked if deleted; 404 only for missing id).
// children: direct replies (depth-1) keyset, oldest-first; dead leaves
//   (deleted with no live descendants) are pruned from the list.
export interface TLogThreadResponse {
    ancestors: TLog[];
    focus: TLog;
    children: {
        items: TLog[];
        nextCursor: string | null;
        hasMore: boolean;
    };
}

// POST /v1/api/log body. parentId=null = top-level (owner-only); non-null =
// reply under an existing live log node (any logged-in user, unlimited depth).
export interface TLogCreateRequest {
    parentId: string | null;
    body: string;
}

// ---------------------------------------------------------------------------
// Phase Y-TD — Log-as-todo types.
// ---------------------------------------------------------------------------

// Derived todo status for a Log node. Only present when:
//   1. The log has due_at set (opt-in: due_at presence = "this is a todo").
//   2. The requesting viewer is the log's OWNER (private field — omitted for
//      any other viewer).
// Rules (mirrors helpers/log/status.ts deriveLogStatus):
//   done_at IS NOT NULL           → 'done'   (done wins over overdue)
//   due_at IS NULL                → undefined (not a todo; field absent)
//   due_at < now() AND done NULL  → 'overdue'
//   else                          → 'todo'
export type TLogTodoStatus = 'todo' | 'done' | 'overdue';

// PATCH /v1/api/log/:id/todo body.
//   dueAt: undefined = unchanged; null = clear (remove todo); string = set/update.
//   done:  undefined = unchanged; true = mark complete; false = reopen.
// Both fields are optional and composable in a single request.
export interface TLogTodoUpdateRequest {
    dueAt?: string | null;
    done?: boolean;
}

// GET /v1/api/log/todos response.
// items: the requested page of TLog nodes (with todo fields, owner-scoped).
// counts: aggregate counts over ALL todos for the owner (not just this page).
// nextCursor / hasMore: keyset continuation on compound (due_at|id) cursor.
export interface TLogTodoListResponse {
    items: TLog[];
    counts: {
        todo: number;
        overdue: number;
        done: number;
    };
    nextCursor: string | null;
    hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Phase Y-M2 — Log social types (likes + follows + timeline).
// ---------------------------------------------------------------------------

// State returned from GET/POST /v1/api/log/:id/like.
// liked: whether the requesting viewer has liked this log node.
// likeCount: live COUNT(*) from log_likes for this node.
export interface TLogLikeState {
    liked: boolean;
    likeCount: number;
}

// State returned from POST /v1/api/follow/:username.
// following: whether the requesting viewer actively follows the target user.
// followerCount: how many active followers the target user has.
// followeeCount: how many users the target user actively follows.
export interface TLogFollowState {
    following: boolean;
    followerCount: number;
    followeeCount: number;
}

// GET /v1/api/log/timeline response (viewer's followed-users fan-in).
// items: top-level log nodes from followed users, newest-first.
// nextCursor / hasMore: keyset continuation on id DESC.
export interface TLogTimelineResponse {
    items: TLog[];
    nextCursor: string | null;
    hasMore: boolean;
}
