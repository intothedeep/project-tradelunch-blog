// apis/getSavedPosts.api.ts
// Purpose: fetch the authenticated user's saved (favorited) posts as full cards,
//   keyset-paginated with optional title/description search.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state. The
//   keyset cursor is a STRING (the previous page's saved_at) and post ids are
//   STRINGS (Snowflake precision) — never Number()/parseInt them. The response
//   interceptor unwraps the HTTP body to { success, data }, so the contract
//   payload is read from `.data`.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
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
    try {
        const envelope = await axios_instance.get<unknown, TSavedPostsEnvelope>(
            '/v1/api/favorites/posts',
            {
                params,
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to load saved posts');
    }
}
