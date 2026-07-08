// apis/getPosts.api.ts
import { TPaginatedResponse } from '@/apis/blog.types';
import { serverRequest } from '@/apis/http.server';

// Multi-facet feed filter. Categories OR (ancestor-inclusive), tags OR,
// cross-attribute AND — all resolved server-side. Each facet is sent as a
// comma-joined string ONLY for the per-author feed (categories are per-author);
// ignored for the all-authors global feed. Caching is the Express RESPONSE's
// job now (Cache-Control set there), so this fetcher sends NO cache headers.
// Express returns { success, data: TPaginatedResponse }.
export type TPostFilters = {
    categories?: string[];
    tags?: string[];
};

interface TEnvelope {
    success: boolean;
    data: TPaginatedResponse;
}

export async function getBlogPostsByUsername(
    cursor: string | number = 0,
    limit: number = 10,
    username: string = '',
    filters?: TPostFilters
): Promise<TPaginatedResponse> {
    const url = username ? `/v1/api/posts/users/${username}` : `/v1/api/posts`;

    const categories = filters?.categories ?? [];
    const tags = filters?.tags ?? [];

    const params = new URLSearchParams();
    if (cursor) params.append('cursor', String(cursor));
    params.append('limit', String(limit));
    if (username && categories.length > 0) {
        params.append('categories', categories.join(','));
    }
    if (username && tags.length > 0) {
        params.append('tags', tags.join(','));
    }

    const qs = params.toString();
    const path = qs ? `${url}?${qs}` : url;

    try {
        const envelope = await serverRequest<TEnvelope>({
            path,
            fallbackError: `Failed to fetch posts: ${username}`,
        });
        return envelope.data;
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw new Error(`Failed to fetch posts: ${username}`);
    }
}
