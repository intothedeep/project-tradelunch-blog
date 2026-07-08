// apis/getPopularTags.api.ts
// Purpose: fetch the GLOBAL popular-tags list for the left-rail TagCloud.
// Server-only fetcher — called exclusively from Server Components.
// Express GET /v1/api/tags returns { success, data: TPopularTag[] }.
// Vestigial Cache-Control/Expires request headers removed — they were no-ops
// on the request side (only response headers affect caching).

import { serverRequest } from '@/apis/http.server';
import { TPopularTag } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TPopularTag[];
}

export async function getPopularTags(limit = 30): Promise<TPopularTag[]> {
    try {
        const envelope = await serverRequest<TEnvelope>({
            path: `/v1/api/tags?limit=${limit}`,
            fallbackError: 'Failed to fetch popular tags',
        });
        return envelope.data;
    } catch (error) {
        console.error('Failed to fetch popular tags:', error);
        throw new Error('Failed to fetch popular tags');
    }
}
