// apis/createPost.api.ts
// Purpose: create a post for the authenticated user (server sets user_id from
// the token; status defaults to 'draft' when omitted).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.

import { clientRequest } from '@/apis/http.client';
import type { TPostInput, TDraftSummary } from '@repo/types';

// POST /v1/api/posts responds { success: true, data: row } — row is TDraftSummary.
interface TEnvelope {
    success: boolean;
    data: TDraftSummary;
}

export async function createPost(
    token: string,
    input: TPostInput
): Promise<TDraftSummary> {
    const envelope = await clientRequest<TEnvelope>({
        path: '/v1/api/posts',
        method: 'POST',
        body: input,
        token,
        fallbackError: 'Failed to create post',
    });
    return envelope.data;
}
