// apis/get-log-stream.api.ts
// Purpose: fetch one page of the per-user top-level log stream (GET /v1/api/log/:username).
// Returns keyset-paginated top-level log posts (newest-first).
// Isomorphic — no token required. Usable from both Server Components (SSR seed)
// and the client hook (infinite scroll).
// Constraints: id/cursor stay STRINGS (BIGINT-safe). Unwraps {success, data} once.

import { clientRequest } from '@/apis/http.client';
import type { TLogStreamResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogStreamResponse;
}

type TGetLogStreamOpts = {
    cursor?: string;
    limit?: number;
};

export async function getLogStream(
    username: string,
    opts?: TGetLogStreamOpts
): Promise<TLogStreamResponse> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.append('cursor', opts.cursor);
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/${encodeURIComponent(username)}${qs}`,
        fallbackError: `Failed to load log stream for ${username}`,
    });
    return envelope.data;
}
