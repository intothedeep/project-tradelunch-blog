// apis/getComments.api.ts
// Purpose: fetch the public comment tree for a post as a FLAT pre-order array
//   (ordered by the server's materialized path; the client nests by depth).
// Constraints: PUBLIC read — no token required (isomorphic; usable from a Server
//   Component). post/comment ids stay STRINGS (Snowflake precision) — never
//   Number()/parseInt. The response interceptor unwraps the HTTP body to
//   { success, data }, so the payload is read from `.data`.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TCommentListResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TCommentListResponse;
}

export async function getComments(
    postId: string
): Promise<TCommentListResponse> {
    try {
        const envelope = await axios_instance.get<unknown, TEnvelope>(
            `/v1/api/posts/${postId}/comments`
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to load comments');
    }
}
