// apis/getLikedPosts.api.ts
// Purpose: fetch the authenticated user's OWN liked post ids from the backend,
//   so the client can seed each LikeButton's viewer state on load. This is the
//   like-counterpart of getFavorites: the cacheable SSR post read returns a
//   public likeCount but an anonymous viewerLiked, so the per-viewer liked flag
//   is resolved client-side here instead.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. Post
//   ids stay STRINGS end-to-end (Snowflake precision) — never Number()/parseInt.

import axios_instance from '@/apis/axios_instance';
import type { TLikedResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TLikedResponse };

// The response interceptor unwraps `response.data`, so the resolved value is the
// full envelope; we return its inner `data`.
export async function getLikedPosts(token: string): Promise<TLikedResponse> {
    const body = await axios_instance.get<unknown, TEnvelope>('/v1/api/likes', {
        headers: { Authorization: `Bearer ${token}` },
    });
    return body.data;
}
