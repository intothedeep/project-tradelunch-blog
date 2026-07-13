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
