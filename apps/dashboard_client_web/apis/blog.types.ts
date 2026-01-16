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
    id?: number;
    content?: string;
    title: string;
    description?: string;
    status?: string;
    slug?: string;
    stored_uri?: string;
    user_id?: number;
    category_id?: string;
    category?: string;
    created_at?: string;
    updated_at?: string;
    date?: string;

    // TODO
    comments?: number;
    upvotes?: number;
    author?: string;
    views?: number;
    username?: string;
    tags?: string[];
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
    nextCursor: number | null;
    hasMore: boolean;
};
