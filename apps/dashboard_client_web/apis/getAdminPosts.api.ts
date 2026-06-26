// apis/getAdminPosts.api.ts
// Purpose: list all posts (incl. draft/private) for admin moderation, keyset
// cursor pagination.
// Constraints: requires a Clerk bearer token; non-admin → 403; non-2xx
// surfaces as ApiError. The response interceptor unwraps the HTTP body to
// { success, data }, so the contract payload is read from `.data`.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TAdminPostListResponse } from '@repo/types';

interface TAdminPostsEnvelope {
    success: boolean;
    data: TAdminPostListResponse;
}

export interface TGetAdminPostsParams {
    cursor?: number;
    limit?: number;
}

export async function getAdminPosts(
    token: string,
    params: TGetAdminPostsParams = {}
): Promise<TAdminPostListResponse> {
    try {
        const envelope = await axios_instance.get<unknown, TAdminPostsEnvelope>(
            '/v1/api/admin/posts',
            {
                params,
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to load admin posts');
    }
}
