// apis/getPosts.api.ts
import { TPaginatedResponse } from '@/apis/blog.types';
import axios_instance from '@/apis/axios_instance';

// Multi-facet feed filter. Categories OR (ancestor-inclusive), tags OR,
// cross-attribute AND — all resolved server-side. Each facet is sent as a
// comma-joined string ONLY for the per-author feed (categories are per-author);
// ignored for the all-authors global feed. Caching is the Express RESPONSE's
// job now (Cache-Control set there), so this fetcher sends NO cache headers.
export type TPostFilters = {
    categories?: string[];
    tags?: string[];
};

export async function getBlogPostsByUsername(
    cursor: string | number = 0,
    limit: number = 10,
    username: string = '',
    filters?: TPostFilters
): Promise<TPaginatedResponse> {
    try {
        const url = username
            ? `/v1/api/posts/users/${username}`
            : `/v1/api/posts`;

        const categories = filters?.categories ?? [];
        const tags = filters?.tags ?? [];

        const response = await axios_instance.get<TPaginatedResponse>(url, {
            params: {
                ...(cursor ? { cursor } : {}),
                limit,
                ...(username && categories.length > 0
                    ? { categories: categories.join(',') }
                    : {}),
                ...(username && tags.length > 0
                    ? { tags: tags.join(',') }
                    : {}),
            },
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw new Error(`Failed to fetch posts: ${username}`);
    }
}
