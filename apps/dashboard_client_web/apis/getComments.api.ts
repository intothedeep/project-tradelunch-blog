// apis/getComments.api.ts
// Purpose: fetch ONE page of the public comment tree for a post as a FLAT
//   pre-order array (50 root comments + their subtrees), plus the cursor cursor
//   metadata (nextCursor + hasMore) for "Load more" pagination.
// Constraints: PUBLIC read — no token required (isomorphic; usable from a Server
//   Component). post/comment ids stay STRINGS (Snowflake precision) — never
//   Number()/parseInt. The response interceptor unwraps the HTTP body to
//   { success, data }, so the payload is read from `.data`. Omit `cursor` when
//   undefined so the server falls back to its first-page sentinel.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TCommentListResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TCommentListResponse;
}

type TGetCommentsOpts = {
    cursor?: string;
    limit?: number;
};

export async function getComments(
    postId: string,
    opts?: TGetCommentsOpts
): Promise<TCommentListResponse> {
    try {
        const params: Record<string, string | number> = {};
        if (opts?.cursor !== undefined) params.cursor = opts.cursor;
        if (opts?.limit !== undefined) params.limit = opts.limit;

        const envelope = await axios_instance.get<unknown, TEnvelope>(
            `/v1/api/posts/${postId}/comments`,
            { params }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to load comments');
    }
}
