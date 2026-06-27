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

export interface TCategoryTreeNode {
    type: typeof ETreeNodeType.CATEGORY;
    id: number;
    title: string;
    slug: null;
    parent_id: number | null;
    group_id: number | null;
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
    id: number;
    title: string;
    slug: string;
    parent_id: number;
    group_id: null;
    level: number;
    priority: number;
    username: string;
    post_id: number;
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
    categoryId?: number | null;
    status?: TPostStatus;
    slug?: string;
}

// List item for GET /users/me/drafts.
export interface TDraftSummary {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: TPostStatus;
    categoryId: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface TImageSignRequest {
    filename: string;
    contentType: string;
}

export interface TImageSignResponse {
    signedUrl: string;
    path: string;
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
