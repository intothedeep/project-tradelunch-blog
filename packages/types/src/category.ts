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
