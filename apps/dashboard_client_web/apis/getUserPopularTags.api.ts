// apis/getUserPopularTags.api.ts
// Purpose: fetch a single author's popular tags (their public-post tags) for the
// scoped right-rail TagCloud (Phase H H5.5).
// Server-only fetcher — called exclusively from Server Components.
// Express GET /v1/api/posts/users/:username/tags returns { success, data: TPopularTag[] }.
// Vestigial Cache-Control/Expires request headers removed — they were no-ops
// on the request side (only response headers affect caching).

import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { logServerError } from '@/utils/serverLog.util';
import { TPopularTag } from '@repo/types';
import { serverRequest } from '@/apis/http.server';

interface TEnvelope {
    success: boolean;
    data: TPopularTag[];
}

// cache(): dedupe per request by value (fetch dedupe is off, see http.core).
export const getUserPopularTags = cache(
    async (username: string, limit = 30): Promise<TPopularTag[]> => {
        try {
            const envelope = await serverRequest<TEnvelope>({
                path: `/v1/api/posts/users/${encodeURIComponent(username)}/tags?limit=${limit}`,
                fallbackError: `Failed to fetch user popular tags: ${username}`,
            });
            return envelope.data;
        } catch (error) {
            unstable_rethrow(error);
            logServerError('Failed to fetch user popular tags', error, {
                username,
            });
            throw new Error(`Failed to fetch user popular tags: ${username}`);
        }
    }
);
