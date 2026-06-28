// API-contract types for the category tree structure.
// These are consumed by both dashboard_client_web and dashboard_server.
// No build step — consumers compile raw TS via transpilePackages / tsc, and the
// server function loads this at runtime via Node's native TS (strip-only) mode.
// IMPORTANT: keep this file strip-only-safe — NO `enum`/`namespace` (Node strip-only
// cannot run them). Use a const-object + union instead of an enum.

export const ETreeNodeType = {
    CATEGORY: 'category',
    POST: 'post',
} as const;

export type ETreeNodeType = (typeof ETreeNodeType)[keyof typeof ETreeNodeType];

// BIGINT id fields are serialized by node-pg as STRINGS (JS numbers lose
// precision past 2^53). Keep every id/parent/group/post id a string end-to-end;
// never Number()/parseInt them.
export interface TCategoryTreeNode {
    type: typeof ETreeNodeType.CATEGORY;
    id: string;
    title: string;
    slug: null;
    parent_id: string | null;
    group_id: string | null;
    level: number;
    priority: number;
    username: string;
    post_id: null;
    description: null;
    created_at: null;
    updated_at: null;
    sort_key: string;
}

export interface TPostTreeNode {
    type: typeof ETreeNodeType.POST;
    id: string;
    title: string;
    slug: string;
    parent_id: string;
    group_id: null;
    level: number;
    priority: number;
    username: string;
    post_id: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    sort_key: string;
}

export interface TCategoryTreeResponse {
    status: number;
    data: {
        categories: TTreeNode[];
    };
}

export type TTreeNode = TCategoryTreeNode | TPostTreeNode;

export type TTreeNodeWithChildren = TTreeNode & {
    children?: TTreeNodeWithChildren[];
    postCount?: number;
};

// ---------------------------------------------------------------------------
// Category write contract (Phase G — editor category selector).
// A category is a node in a depth-1..3 tree; a post stores a SINGLE leaf id
// (posts.category_id). All ids are STRINGS (BIGINT/snowflake-safe). Title is
// stored/compared LOWERCASE (canonical).
// ---------------------------------------------------------------------------

// A single category node (camelCase API shape). groupId = root-ancestor id.
export interface TCategoryNode {
    id: string;
    parentId: string | null;
    groupId: string | null;
    title: string;
    level: number;
    priority: number;
}

// POST /v1/api/categories body. parentId null/absent = a root (level 0).
export interface TCreateCategoryInput {
    title: string;
    parentId?: string | null;
}

// ---------------------------------------------------------------------------
// D2 write-contract types (create/update post, drafts, image upload signing).
// Request/response DTOs use camelCase (API boundary); DB-row read shapes above
// stay snake_case. 'draft' is added to post_status_enum in a parallel migration.
// ---------------------------------------------------------------------------

export type TPostStatus = 'public' | 'private' | 'follower' | 'draft';

// Create/update request body. Title required; rest optional for PATCH semantics.
export interface TPostInput {
    title: string;
    content?: string;
    description?: string;
    // SINGLE leaf category id, a STRING (BIGINT-safe; never Number() it).
    // Tri-state on PATCH: undefined = leave untouched; null = clear (drafts only —
    // publish requires a non-null category); numeric string = set.
    categoryId?: string | null;
    // Tag set (lowercase canonical). undefined = leave untouched on PATCH; an
    // array (including empty) = REPLACE the post's whole tag set.
    tags?: string[];
    status?: TPostStatus;
    slug?: string;
    // Author-chosen thumbnail. Absolute CDN URL from the image-sign step.
    // Tri-state (mirrors the COALESCE PATCH semantics): undefined = leave the
    // existing thumbnail untouched; null = clear it; non-empty string = set/replace.
    thumbnailUrl?: string | null;
}

// List item for GET /users/me/drafts.
// id is a Postgres BIGINT, serialized as a string (JS numbers lose precision
// past 2^53). Keep it a string end-to-end; never Number() it.
export interface TDraftSummary {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: TPostStatus;
    categoryId: number | null;
    createdAt: string;
    updatedAt: string;
}

// Phase F: Express-proxied image upload. The browser POSTs multipart `file`;
// the server resizes (sharp → webp) and uploads to Supabase Storage, returning
// the absolute public URL. Supersedes the removed TImageSign{Request,Response}.
export interface TImageUploadResponse {
    publicUrl: string;
}

// ---------------------------------------------------------------------------
// D4 admin API contract (admin post moderation: list + status change).
// Reuses TPostStatus. Cursor-based pagination over all users' posts.
// ---------------------------------------------------------------------------

export interface TAdminPostListItem {
    id: number;
    userId: number;
    username: string | null;
    slug: string;
    title: string;
    status: TPostStatus;
    createdAt: string;
    updatedAt: string;
}

export interface TAdminPostListResponse {
    items: TAdminPostListItem[];
    nextCursor: string | number | null;
    hasMore: boolean;
}

export interface TAdminPostStatusInput {
    status: TPostStatus;
}

// ---------------------------------------------------------------------------
// Post favorites contract (Phase 2 — blog post-card Save persistence).
// Snowflake post ids are STRINGS end-to-end; never Number()/parseInt them.
// ---------------------------------------------------------------------------

// GET /v1/api/favorites → { success, data: TFavoritesResponse }
export interface TFavoritesResponse {
    postIds: string[];
}

// POST/DELETE /v1/api/favorites/:postId → { success, data: TFavoriteToggleResponse }
export interface TFavoriteToggleResponse {
    postId: string;
    favorited: boolean;
}

// ---------------------------------------------------------------------------
// Post likes contract (Phase E — public like count). A like is a PUBLIC
// approval signal: likeCount is a live aggregate COUNT(*) visible to everyone.
// Snowflake post ids are STRINGS end-to-end; never Number()/parseInt them.
// ---------------------------------------------------------------------------

// POST /v1/api/posts/:postId/like → { success, data: TLikeToggleResponse }
// Toggle: the response reflects the resulting state after the toggle.
export interface TLikeToggleResponse {
    liked: boolean;
    likeCount: number;
}

// GET /v1/api/likes → { success, data: TLikedResponse }
// The caller's OWN liked post ids — lets the client seed each LikeButton's
// viewer state without forwarding a token through the (cacheable) SSR post
// read. Mirrors TFavoritesResponse; ids stay STRINGS (Snowflake precision).
export interface TLikedResponse {
    postIds: string[];
}

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
