// apis/getUserPopularTags.api.ts
// Purpose: fetch a single author's popular tags (their public-post tags) for the
// scoped right-rail TagCloud (Phase H H5.5). Mirrors getPopularTags: shared
// axios_instance + single `.data`.
// Side effects: network GET. Throws on failure so the server TagCloud can
// try/catch into a graceful rail-level fallback.

import { TPopularTag } from '@repo/types';
import axios_instance from '@/apis/axios_instance';

export async function getUserPopularTags(
    username: string,
    limit = 30
): Promise<TPopularTag[]> {
    try {
        const response = await axios_instance.get<TPopularTag[]>(
            `/v1/api/posts/users/${encodeURIComponent(username)}/tags`,
            {
                params: { limit },
                headers: {
                    'Cache-Control': 'public, max-age=3600',
                    Expires: new Date(Date.now() + 3600 * 1000).toUTCString(),
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error('Failed to fetch user popular tags:', error);
        throw new Error(`Failed to fetch user popular tags: ${username}`);
    }
}
