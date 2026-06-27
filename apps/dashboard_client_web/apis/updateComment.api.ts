// apis/updateComment.api.ts
// Purpose: edit a comment's plain-text body. The server replaces the body and
//   bumps updatedAt, returning the updated TComment. Authorized for the comment
//   author, the post owner, or an admin (the server enforces this).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   The comment id stays a STRING (Snowflake precision) — never Number().

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TComment, TCommentUpdateRequest } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TComment;
}

export async function updateComment(
    token: string,
    commentId: string,
    body: string
): Promise<TComment> {
    try {
        const payload: TCommentUpdateRequest = { body };
        const envelope = await axios_instance.patch<unknown, TEnvelope>(
            `/v1/api/comments/${commentId}`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to update comment');
    }
}
