// apis/deleteComment.api.ts
// Purpose: soft-delete a comment (tombstone). The server preserves the original
//   body and replies; the read masks the body to "[deleted]". Authorized for the
//   comment author, the post owner, or an admin (the server enforces this).
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   The comment id stays a STRING (Snowflake precision) — never Number().

import { clientRequest } from '@/apis/http.client';
import type { TComment } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TComment;
}

export async function deleteComment(
    token: string,
    commentId: string
): Promise<TComment> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/comments/${commentId}`,
        method: 'DELETE',
        token,
        fallbackError: 'Failed to delete comment',
    });
    return envelope.data;
}
