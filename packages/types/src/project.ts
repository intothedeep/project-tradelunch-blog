// API-contract types for the Projects screens.
// BIGINT ids (project_id, post_id, id, seq) are STRINGS end-to-end; never
// Number()/parseInt them. Field names are snake_case like TTreeNode.

export interface TProjectRef {
    project_id: string; // categories.id
    project: string; // categories.title = URL segment
}

export interface TProjectCard extends TProjectRef {
    post_count: number; // sub-categories included, after slug de-duplication
    // First post by priority ASC, seq ASC; null when the project has no visible post.
    overview: {
        post_id: string;
        slug: string;
        title: string;
        stored_uri: string | null; // files.is_thumbnail
    } | null;
}

export interface TProjectPost {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    priority: number;
    seq: string; // int8
    stored_uri: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}
