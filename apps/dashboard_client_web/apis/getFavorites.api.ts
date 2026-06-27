// apis/getFavorites.api.ts
// Purpose: fetch the authenticated user's favorited post ids from the backend.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. Post
//   ids stay STRINGS end-to-end (Snowflake precision) — never Number()/parseInt.

import axios_instance from '@/apis/axios_instance';
import type { TFavoritesResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TFavoritesResponse };

// The response interceptor unwraps `response.data`, so the resolved value is the
// full envelope; we return its inner `data`.
export async function getFavorites(token: string): Promise<TFavoritesResponse> {
    const body = await axios_instance.get<unknown, TEnvelope>(
        '/v1/api/favorites',
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return body.data;
}
