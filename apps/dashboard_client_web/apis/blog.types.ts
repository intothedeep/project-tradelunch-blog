// ============================================================================
// Types
// ============================================================================
// export enum ETreeNodeType {
//     CATEGORY = 'category',
//     POST = 'post',
// }

// import { ETreeNodeType } from '@repo/markdown-parsing';

// export interface TCategoryTreeNode {
//     type: ETreeNodeType.CATEGORY;
//     id: number;
//     title: string;
//     slug: null;
//     parent_id: number | null;
//     group_id: number | null;
//     level: number;
//     priority: number;
//     username: string;
//     post_id: null;
//     description: null;
//     created_at: null;
//     updated_at: null;
//     sort_key: string;
// }

// export interface TPostTreeNode {
//     type: ETreeNodeType.POST;
//     id: number;
//     title: string;
//     slug: string;
//     parent_id: number;
//     group_id: null;
//     level: number;
//     priority: number;
//     username: string;
//     post_id: number;
//     description: string | null;
//     created_at: string;
//     updated_at: string;
//     sort_key: string;
// }

// export type TTreeNode = TCategoryTreeNode | TPostTreeNode;

// export type TTreeNodeWithChildren = TTreeNode & {
//     children?: TTreeNodeWithChildren[];
//     postCount?: number;
// };

export type TPost = {
    id: string;
    content?: string;
    title: string;
    description?: string;
    status?: string;
    slug?: string;
    stored_uri?: string;
    // BIGINT ids as STRINGS (Snowflake precision); never Number()/parseInt them.
    user_id?: string;
    category_id?: string;
    category?: string;
    created_at?: string;
    updated_at?: string;
    date?: string;

    // Engagement counts surfaced by the post read queries (Phase E — Likes /
    // Comments). likeCount/commentCount are live COUNT(*)s; viewerLiked is the
    // per-viewer "did I like this" boolean. commentCount stays 0 until the
    // Comments feature lands.
    likeCount: number;
    viewerLiked: boolean;
    commentCount: number;

    author?: string;
    views?: number;
    username?: string;
    tags?: string[];

    // Optional author profile fields the backend may attach (graceful: absent → no byline).
    display_name?: string;
    avatar_url?: string;
};

export interface FeaturedPost extends TPost {
    reposts?: number;
}

export interface RecentPost extends TPost {
    readTime?: string;
}

export type TPaginatedResponse = {
    success: boolean;
    posts: TPost[];
    nextCursor: string | null;
    hasMore: boolean;
};
