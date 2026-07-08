// apis/getFavorites.api.ts
// Purpose: fetch the authenticated user's favorited post ids from the backend.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. Post
//   ids stay STRINGS end-to-end (Snowflake precision) — never Number()/parseInt.
//   Express returns { success, data: TFavoritesResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TFavoritesResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TFavoritesResponse };

export async function getFavorites(token: string): Promise<TFavoritesResponse> {
    const body = await clientRequest<TEnvelope>({
        path: '/v1/api/favorites',
        token,
        fallbackError: 'Failed to load favorites',
    });
    return body.data;
}
