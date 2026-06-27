// apis/createComment.api.ts
// Purpose: create a comment (or reply) on a post. The body is PLAIN TEXT; an
//   optional parentId nests the reply under an existing comment (Option C — the
//   server computes path = parent.path || newId, so the reply lands under its
//   ACTUAL parent at any depth).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   post/parent ids stay STRINGS (Snowflake precision) — never Number().

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
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
    try {
        const envelope = await axios_instance.post<unknown, TEnvelope>(
            `/v1/api/posts/${postId}/comments`,
            input,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to create comment');
    }
}
