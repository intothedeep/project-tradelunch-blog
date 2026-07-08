// apis/getComments.api.ts
// Purpose: fetch ONE page of the public comment tree for a post as a FLAT
//   pre-order array (50 root comments + their subtrees), plus the cursor
//   metadata (nextCursor + hasMore) for "Load more" pagination.
// Constraints: PUBLIC read — no token required (isomorphic; usable from a Server
//   Component). post/comment ids stay STRINGS (Snowflake precision) — never
//   Number()/parseInt. Omit `cursor` when undefined so the server falls back to
//   its first-page sentinel. Express returns { success, data: TCommentListResponse }.

import { clientRequest } from '@/apis/http.client';
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
    const query: Record<string, string | number | boolean | undefined> = {};
    if (opts?.cursor !== undefined) query.cursor = opts.cursor;
    if (opts?.limit !== undefined) query.limit = opts.limit;

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/posts/${postId}/comments`,
        query,
        fallbackError: 'Failed to load comments',
    });
    return envelope.data;
}
