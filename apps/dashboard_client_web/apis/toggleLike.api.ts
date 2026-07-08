// apis/toggleLike.api.ts
// Purpose: toggle the authenticated user's like on a post (server decides the
//   resulting state and returns the live like count).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError. The
//   postId stays a STRING (Snowflake precision) — never Number()/parseInt.
//   Express POST /v1/api/posts/:postId/like returns { success, data: TLikeToggleResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TLikeToggleResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TLikeToggleResponse };

export async function toggleLike(
    token: string,
    postId: string
): Promise<TLikeToggleResponse> {
    const body = await clientRequest<TEnvelope>({
        path: `/v1/api/posts/${postId}/like`,
        method: 'POST',
        token,
        fallbackError: 'Failed to toggle like',
    });
    return body.data;
}
