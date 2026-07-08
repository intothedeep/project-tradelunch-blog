// apis/getSavedPosts.api.ts
// Purpose: fetch the authenticated user's saved (favorited) posts as full cards,
//   keyset-paginated with optional title/description search.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. The
//   keyset cursor is a STRING (the previous page's saved_at) and post ids are
//   STRINGS (Snowflake precision) — never Number()/parseInt them.
//   Express GET /v1/api/favorites/posts returns { success, data: TSavedPostsResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TPost } from '@/apis/blog.types';

export interface TSavedPostsResponse {
    posts: TPost[];
    nextCursor: string | null;
}

interface TSavedPostsEnvelope {
    success: boolean;
    data: TSavedPostsResponse;
}

export interface TGetSavedPostsParams {
    query?: string;
    cursor?: string;
    limit?: number;
}

export async function getSavedPosts(
    token: string,
    params: TGetSavedPostsParams = {}
): Promise<TSavedPostsResponse> {
    const envelope = await clientRequest<TSavedPostsEnvelope>({
        path: '/v1/api/favorites/posts',
        token,
        query: params as Record<string, string | number | boolean | undefined>,
        fallbackError: 'Failed to load saved posts',
    });
    return envelope.data;
}
