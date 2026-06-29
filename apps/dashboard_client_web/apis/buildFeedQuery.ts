// apis/buildFeedQuery.ts
// Purpose: build the blog feed request path (+ query string) from feed params.
// Behavior-preserving extraction of the URL/param logic from getPosts.api.ts so
// both the axios fetcher and the native-fetch server wrapper share one source.
// Constraints: pure — deterministic input → output, no I/O, no hidden state.
// Invariant: categories/tags are sent ONLY for the per-author feed (they are
// per-author server-side); cursor is sent ONLY when truthy.

export type TBuildFeedQuery = {
    cursor?: string | number;
    limit: number;
    username?: string;
    categories?: string[];
    tags?: string[];
};

export function buildFeedQuery({
    cursor,
    limit,
    username = '',
    categories = [],
    tags = [],
}: TBuildFeedQuery): { path: string } {
    const base = username ? `/v1/api/posts/users/${username}` : `/v1/api/posts`;

    const params = new URLSearchParams();
    if (cursor) params.set('cursor', String(cursor));
    params.set('limit', String(limit));
    if (username && categories.length > 0) {
        params.set('categories', categories.join(','));
    }
    if (username && tags.length > 0) {
        params.set('tags', tags.join(','));
    }

    const qs = params.toString();
    return { path: qs ? `${base}?${qs}` : base };
}
