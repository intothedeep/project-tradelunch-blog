// apis/toggleLike.api.ts
// Purpose: toggle the authenticated user's like on a post (server decides the
//   resulting state and returns the live like count).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError. The
//   postId stays a STRING (Snowflake precision) — never Number()/parseInt.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TLikeToggleResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TLikeToggleResponse };

export async function toggleLike(
    token: string,
    postId: string
): Promise<TLikeToggleResponse> {
    try {
        const body = await axios_instance.post<unknown, TEnvelope>(
            `/v1/api/posts/${postId}/like`,
            undefined,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return body.data;
    } catch (error) {
        throw toApiError(error, 'Failed to toggle like');
    }
}
