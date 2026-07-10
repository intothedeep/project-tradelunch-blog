// apis/get-log-global.api.ts
// Purpose: fetch one page of the GLOBAL top-level log stream (GET /v1/api/log).
// All users' top-level log posts, keyset-paginated newest-first. The /log
// discovery feed. Isomorphic — no token required (public read).
// Constraints: id/cursor stay STRINGS (BIGINT-safe). Unwraps {success, data} once.

import { clientRequest } from '@/apis/http.client';
import type { TLogStreamResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogStreamResponse;
}

type TGetLogGlobalOpts = {
    cursor?: string;
    limit?: number;
};

export async function getLogGlobalStream(
    opts?: TGetLogGlobalOpts
): Promise<TLogStreamResponse> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.append('cursor', opts.cursor);
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log${qs}`,
        fallbackError: 'Failed to load global log stream',
    });
    return envelope.data;
}
