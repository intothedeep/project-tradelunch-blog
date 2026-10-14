// apis/getUserProfile.api.ts
// Purpose: fetch the lightweight author profile for the per-user right rail
// (Phase H H5.5).
// Server-only fetcher — called exclusively from Server Components.
// Express GET /v1/api/posts/users/:username/profile returns { success, data: TUserProfile }.
// A 404 (unknown user) resolves to null so the rail degrades gracefully; other
// failures throw for the caller's try/catch.

import { cache } from 'react';
import { logServerError } from '@/utils/serverLog.util';
import { ApiError } from '@/utils/apiError.util';
import { TUserProfile } from '@repo/types';
import { serverRequest } from '@/apis/http.server';

interface TEnvelope {
    success: boolean;
    data: TUserProfile;
}

// cache(): layout, generateMetadata and the rails read this several times per
// request; fetch dedupe is off (http.core always passes a signal), so dedupe
// by value here. Positional primitive arg => keyed by value.
export const getUserProfile = cache(
    async (username: string): Promise<TUserProfile | null> => {
        try {
            const envelope = await serverRequest<TEnvelope>({
                path: `/v1/api/posts/users/${encodeURIComponent(username)}/profile`,
                fallbackError: `Failed to fetch user profile: ${username}`,
            });
            return envelope.data;
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                return null;
            }
            logServerError('Failed to fetch user profile', error, { username });
            throw new Error(`Failed to fetch user profile: ${username}`);
        }
    }
);
