// apis/get-log-timeline.api.ts
// Purpose: fetch one page of the auth viewer's timeline (GET /v1/api/log/timeline).
//   Top-level logs from followed users, keyset-paginated id DESC (newest-first).
//   Requires a Clerk bearer token (auth-only endpoint). Returns 503 until
//   migration 0024 is applied — callers handle that gracefully.
// Constraints: id/cursor stay STRINGS (BIGINT-safe). Unwraps envelope once.

import { clientRequest } from '@/apis/http.client';
import type { TLogTimelineResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogTimelineResponse;
}

type TGetLogTimelineOpts = {
    cursor?: string;
    limit?: number;
};

export async function getLogTimeline(
    token: string,
    opts?: TGetLogTimelineOpts
): Promise<TLogTimelineResponse> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.append('cursor', opts.cursor);
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/timeline${qs}`,
        token,
        fallbackError: 'Failed to load timeline',
    });
    return envelope.data;
}
