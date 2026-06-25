// API-contract types for the category tree structure.
// These are consumed by both dashboard_client_web and dashboard_server.
// No build step — consumers compile raw TS via transpilePackages / tsc.

export enum ETreeNodeType {
    CATEGORY = 'category',
    POST = 'post',
}

export interface TCategoryTreeNode {
    type: ETreeNodeType.CATEGORY;
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
    type: ETreeNodeType.POST;
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
