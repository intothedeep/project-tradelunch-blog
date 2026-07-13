// GET /v1/api/posts/users/:username/profile — lightweight author profile card
// source (Phase H H5.5/F9). postCount = DISTINCT public, non-deleted slugs (so a
// versioned slug counts once, matching the slug-deduped feed). Viewer-agnostic.
export interface TUserProfile {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    postCount: number;
}
