// apis/get-log-thread.api.ts
// Purpose: fetch the focus-node thread view (GET /v1/api/log/thread/:id).
// Returns ancestors (root→parent, flat), the focus log node, and the first page
// of direct children (depth-1) with keyset cursor metadata.
// Isomorphic — no token required. Usable from Server Components (SSR seed)
// and the client hook for subsequent children pages.
// Constraints: id/cursor stay STRINGS (BIGINT-safe). Unwraps {success, data} once.

import { clientRequest } from '@/apis/http.client';
import type { TLogThreadResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogThreadResponse;
}

type TGetLogThreadOpts = {
    childrenCursor?: string;
    limit?: number;
};

export async function getLogThread(
    logId: string,
    opts?: TGetLogThreadOpts
): Promise<TLogThreadResponse> {
    const params = new URLSearchParams();
    if (opts?.childrenCursor !== undefined)
        params.append('cursor', opts.childrenCursor);
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/thread/${encodeURIComponent(logId)}${qs}`,
        fallbackError: `Failed to load log thread for ${logId}`,
    });
    return envelope.data;
}
