// ---------------------------------------------------------------------------
// Threaded comments contract (Phase E — Option C: materialized BIGINT[] path,
// UNLIMITED depth). The list is a FLAT pre-order array (ordered by `path`); the
// client builds indentation from `depth`. Snowflake ids are STRINGS end-to-end;
// never Number()/parseInt them. A tombstoned comment masks its body to
// "[deleted]" at READ and sets isDeleted (the original stays in the DB).
// ---------------------------------------------------------------------------

export interface TComment {
    id: string;
    postId: string;
    userId: string;
    parentId: string | null;
    // Self-inclusive materialized path (path = parent.path || id); depth =
    // path.length - 1 (0 = top-level). Strings: Snowflake ids never Number()-ed.
    path: string[];
    depth: number;
    // "[deleted]" when isDeleted (tombstone); the original body stays in the DB.
    body: string;
    // Author username; omitted/undefined for a tombstoned comment.
    authorName?: string;
    createdAt: string;
    // Last-edit timestamp; equals createdAt when never edited. `edited` is
    // derived as updatedAt !== createdAt (no separate boolean on the wire).
    updatedAt: string;
    isDeleted: boolean;
}

// GET /v1/api/posts/:postId/comments → { success, data: TCommentListResponse }
// Flat pre-order array; the client nests by depth/parentId. A page is 50 ROOT
// comments (newest-first), each returned with its FULL descendant subtree so
// replies never orphan; replies do NOT count toward the page size.
// nextCursor = the last ROOT id of the page (string), or null when exhausted.
export interface TCommentListResponse {
    comments: TComment[];
    nextCursor: string | null;
    hasMore: boolean;
}

// POST /v1/api/posts/:postId/comments body. body is PLAIN TEXT (not markdown);
// parentId nests a reply under an existing comment on the same post.
export interface TCommentCreateRequest {
    body: string;
    parentId?: string | null;
}

// PATCH /v1/api/comments/:commentId body. body is PLAIN TEXT (not markdown),
// trimmed/non-empty/length-capped server-side; replaces the existing body and
// bumps updatedAt. Editing is author/post-owner/admin (same policy as delete).
export interface TCommentUpdateRequest {
    body: string;
}
