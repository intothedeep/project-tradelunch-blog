// apis/removeFavorite.api.ts
// Purpose: unfavorite a post for the authenticated user.
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError. The
//   postId stays a STRING (Snowflake precision) — never Number()/parseInt.
//   Express DELETE /v1/api/favorites/:postId returns { success, data: TFavoriteToggleResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TFavoriteToggleResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TFavoriteToggleResponse };

export async function removeFavorite(
    token: string,
    postId: string
): Promise<TFavoriteToggleResponse> {
    const body = await clientRequest<TEnvelope>({
        path: `/v1/api/favorites/${postId}`,
        method: 'DELETE',
        token,
        fallbackError: 'Failed to remove favorite',
    });
    return body.data;
}
