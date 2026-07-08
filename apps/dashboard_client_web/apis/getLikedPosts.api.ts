// apis/getLikedPosts.api.ts
// Purpose: fetch the authenticated user's OWN liked post ids from the backend,
//   so the client can seed each LikeButton's viewer state on load. This is the
//   like-counterpart of getFavorites: the cacheable SSR post read returns a
//   public likeCount but an anonymous viewerLiked, so the per-viewer liked flag
//   is resolved client-side here instead.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. Post
//   ids stay STRINGS end-to-end (Snowflake precision) — never Number()/parseInt.
//   Express returns { success, data: TLikedResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TLikedResponse } from '@repo/types';

type TEnvelope = { success: boolean; data: TLikedResponse };

export async function getLikedPosts(token: string): Promise<TLikedResponse> {
    const body = await clientRequest<TEnvelope>({
        path: '/v1/api/likes',
        token,
        fallbackError: 'Failed to load liked posts',
    });
    return body.data;
}
