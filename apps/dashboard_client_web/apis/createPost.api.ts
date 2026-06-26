// apis/createPost.api.ts
// Purpose: create a post for the authenticated user (server sets user_id from
// the token; status defaults to 'draft' when omitted).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TPostInput, TDraftSummary } from '@repo/types';

export async function createPost(
    token: string,
    input: TPostInput
): Promise<TDraftSummary> {
    try {
        return await axios_instance.post<unknown, TDraftSummary>(
            '/v1/api/posts',
            input,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to create post');
    }
}
