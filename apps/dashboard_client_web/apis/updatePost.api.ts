// apis/updatePost.api.ts
// Purpose: update an owned post (PATCH semantics — partial TPostInput).
// Constraints: requires a Clerk bearer token; 404 when not owner; non-2xx
// surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TPostInput, TDraftSummary } from '@repo/types';

export async function updatePost(
    token: string,
    postId: number,
    input: Partial<TPostInput>
): Promise<TDraftSummary> {
    try {
        return await axios_instance.patch<unknown, TDraftSummary>(
            `/v1/api/posts/${postId}`,
            input,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to update post');
    }
}
