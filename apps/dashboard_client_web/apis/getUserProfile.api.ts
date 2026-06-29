// apis/getUserProfile.api.ts
// Purpose: fetch the lightweight author profile for the per-user right rail
// (Phase H H5.5). Mirrors getPopularTags: shared axios_instance + single `.data`
// (the response interceptor already unwraps the axios envelope one level).
// Side effects: network GET. A 404 (unknown user) resolves to null so the rail
// degrades gracefully; other failures throw for the caller's try/catch.

import axios from 'axios';
import { TUserProfile } from '@repo/types';
import axios_instance from '@/apis/axios_instance';

export async function getUserProfile(
    username: string
): Promise<TUserProfile | null> {
    try {
        const response = await axios_instance.get<TUserProfile>(
            `/v1/api/posts/users/${encodeURIComponent(username)}/profile`
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
        }
        console.error('Failed to fetch user profile:', error);
        throw new Error(`Failed to fetch user profile: ${username}`);
    }
}
