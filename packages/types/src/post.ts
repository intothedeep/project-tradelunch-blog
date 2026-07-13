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
    categoryId: string | null;
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
    // BIGINT ids as STRINGS (Snowflake precision); never Number()/parseInt them.
    id: string;
    userId: string;
    username: string | null;
    slug: string;
    title: string;
    status: TPostStatus;
    createdAt: string;
    updatedAt: string;
}

export interface TAdminPostListResponse {
    items: TAdminPostListItem[];
    nextCursor: string | null;
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
// Tag read contract (Phase H — P0 backend tag read APIs).
// Two read shapes: (1) popular-tag counts (global + per-user), (2) a tag-filtered
// post feed reusing the public feed's read-row. All ids stay STRINGS (Snowflake
// precision); never Number()/parseInt them — including the keyset cursor.
//
// NOTE: the public feed read-row (TPost in the CLIENT app's apis/blog.types.ts)
// is NOT exported from @repo/types — and apps cannot be imported by packages
// (dependency direction apps -> packages). To give the tag-feed RESPONSE a
// shared contract without an illegal back-import, the canonical read-row is
// introduced here as TFeedPost. (Flagged for architect: the client TPost should
// later re-derive from this rather than stay a parallel definition.)
// ---------------------------------------------------------------------------

// GET /v1/api/tags and GET /v1/api/posts/users/:username/tags → TPopularTag[]
// count is a live COUNT(*) of LIVE post_tags links on PUBLIC posts only.
export interface TPopularTag {
    tag: string;
    count: number;
}

// Public feed read-row (snake_case DB columns + camelCase engagement counts),
// mirroring what the global feed query selects. Snowflake ids are STRINGS.
export interface TFeedPost {
    id: string;
    user_id?: string;
    username?: string;
    slug?: string;
    title: string;
    description?: string | null;
    content?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
    category_id?: string | null;
    stored_uri?: string | null;
    category?: string | null;
    // Full root→leaf category title path (e.g. ['투자','반도체','메모리']) for
    // breadcrumb display; null when uncategorized or an ancestor is soft-deleted.
    category_path?: string[] | null;
    date?: string;
    tags?: string[] | null;
    likeCount: number;
    viewerLiked: boolean;
    commentCount: number;
}

// GET /v1/api/posts/by-tag/:tag and .../users/:username/by-tag/:tag.
// Keyset-paginated, slug-deduped (latest public revision per slug). nextCursor is
// the last returned row's id as a STRING (null when exhausted).
export interface TTagFeedResponse {
    posts: TFeedPost[];
    nextCursor: string | null;
    hasMore: boolean;
}
