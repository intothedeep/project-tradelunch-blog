// apis/updatePost.api.ts
// Purpose: update an owned post (PATCH semantics — partial TPostInput).
// Constraints: requires a Clerk bearer token; 404 when not owner; non-2xx
// surfaces as ApiError.
// Express PATCH /v1/api/posts/:postid returns { success, data: TDraftSummary }.

import { clientRequest } from '@/apis/http.client';
import type { TPostInput, TDraftSummary } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TDraftSummary;
}

export async function updatePost(
    token: string,
    postId: string,
    input: Partial<TPostInput>
): Promise<TDraftSummary> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/posts/${postId}`,
        method: 'PATCH',
        body: input,
        token,
        fallbackError: 'Failed to update post',
    });
    return envelope.data;
}
