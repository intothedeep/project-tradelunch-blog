// apis/removeFavorite.api.ts
// Purpose: unfavorite a post for the authenticated user.
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError. The
//   postId stays a STRING (Snowflake precision) — never Number()/parseInt.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TFavoriteToggleResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TFavoriteToggleResponse };

export async function removeFavorite(
    token: string,
    postId: string
): Promise<TFavoriteToggleResponse> {
    try {
        const body = await axios_instance.delete<unknown, TEnvelope>(
            `/v1/api/favorites/${postId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return body.data;
    } catch (error) {
        throw toApiError(error, 'Failed to remove favorite');
    }
}
