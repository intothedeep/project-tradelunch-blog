// apis/addFavorite.api.ts
// Purpose: favorite a post for the authenticated user (idempotent on the server).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError. The
//   postId stays a STRING (Snowflake precision) — never Number()/parseInt.

import { clientRequest } from '@/apis/http.client';
import type { TFavoriteToggleResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TFavoriteToggleResponse };

export async function addFavorite(
    token: string,
    postId: string
): Promise<TFavoriteToggleResponse> {
    const env = await clientRequest<TEnvelope>({
        path: `/v1/api/favorites/${postId}`,
        method: 'POST',
        token,
        fallbackError: 'Failed to add favorite',
    });
    return env.data;
}
