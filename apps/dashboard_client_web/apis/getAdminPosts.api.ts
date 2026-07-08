// apis/getAdminPosts.api.ts
// Purpose: list all posts (incl. draft/private) for admin moderation, keyset
// cursor pagination.
// Constraints: requires a Clerk bearer token; non-admin → 403; non-2xx
// surfaces as ApiError. Express returns { success, data: TAdminPostListResponse }.

import { clientRequest } from '@/apis/http.client';
import type { TAdminPostListResponse } from '@repo/types';

interface TAdminPostsEnvelope {
    success: boolean;
    data: TAdminPostListResponse;
}

export interface TGetAdminPostsParams {
    cursor?: string | number;
    limit?: number;
}

export async function getAdminPosts(
    token: string,
    params: TGetAdminPostsParams = {}
): Promise<TAdminPostListResponse> {
    const envelope = await clientRequest<TAdminPostsEnvelope>({
        path: '/v1/api/admin/posts',
        token,
        query: params as Record<string, string | number | boolean | undefined>,
        fallbackError: 'Failed to load admin posts',
    });
    return envelope.data;
}
