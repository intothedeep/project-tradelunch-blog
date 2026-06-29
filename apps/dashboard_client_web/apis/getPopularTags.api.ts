// apis/getPopularTags.api.ts
// Purpose: fetch the GLOBAL popular-tags list for the left-rail TagCloud.
// Mirrors getPosts.api: shared axios_instance + single `.data` (the response
// interceptor already unwraps the axios envelope one level).
// Side effects: network GET. Throws on failure so callers (server TagCloud) can
// try/catch into a graceful rail-level fallback.

import { TPopularTag } from '@repo/types';
import axios_instance from '@/apis/axios_instance';

export async function getPopularTags(limit = 30): Promise<TPopularTag[]> {
    try {
        const response = await axios_instance.get<TPopularTag[]>(
            '/v1/api/tags',
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
        console.error('Failed to fetch popular tags:', error);
        throw new Error('Failed to fetch popular tags');
    }
}
