// API-contract types for the category tree structure.
// BIGINT id fields are serialized by node-pg as STRINGS (JS numbers lose
// precision past 2^53). Keep every id/parent/group/post id a string end-to-end;
// never Number()/parseInt them.

export const ETreeNodeType = {
    CATEGORY: 'category',
    POST: 'post',
} as const;

export type ETreeNodeType = (typeof ETreeNodeType)[keyof typeof ETreeNodeType];

export interface TCategoryTreeNode {
    type: typeof ETreeNodeType.CATEGORY;
    // Postgres BIGINT (int8) — carried as a STRING end-to-end; JS numbers lose
    // precision past 2^53. Never Number()/parseInt these ids.
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
    // BIGINT ids as STRINGS (Snowflake precision); never Number()/parseInt them.
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

export type TTreeNode = TCategoryTreeNode | TPostTreeNode;

export type TTreeNodeWithChildren = TTreeNode & {
    children?: TTreeNodeWithChildren[];
    postCount?: number;
};

export interface TCategoryTreeResponse {
    status: number;
    data: {
        categories: TTreeNode[];
    };
}
