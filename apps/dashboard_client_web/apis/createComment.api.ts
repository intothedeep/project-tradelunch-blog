// apis/createComment.api.ts
// Purpose: create a comment (or reply) on a post. The body is PLAIN TEXT; an
//   optional parentId nests the reply under an existing comment (Option C — the
//   server computes path = parent.path || newId, so the reply lands under its
//   ACTUAL parent at any depth).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   post/parent ids stay STRINGS (Snowflake precision) — never Number().

import { clientRequest } from '@/apis/http.client';
import type { TComment, TCommentCreateRequest } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TComment;
}

export async function createComment(
    token: string,
    postId: string,
    input: TCommentCreateRequest
): Promise<TComment> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/posts/${postId}/comments`,
        method: 'POST',
        body: input,
        token,
        fallbackError: 'Failed to create comment',
    });
    return envelope.data;
}
