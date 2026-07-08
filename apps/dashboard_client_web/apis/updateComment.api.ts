// apis/updateComment.api.ts
// Purpose: edit a comment's plain-text body. The server replaces the body and
//   bumps updatedAt, returning the updated TComment. Authorized for the comment
//   author, the post owner, or an admin (the server enforces this).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   The comment id stays a STRING (Snowflake precision) — never Number().
//   Express PATCH /v1/api/comments/:id returns { success, data: TComment }.

import { clientRequest } from '@/apis/http.client';
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
    const payload: TCommentUpdateRequest = { body };
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/comments/${commentId}`,
        method: 'PATCH',
        body: payload,
        token,
        fallbackError: 'Failed to update comment',
    });
    return envelope.data;
}
