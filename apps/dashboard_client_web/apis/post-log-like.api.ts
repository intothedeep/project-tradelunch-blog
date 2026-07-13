// apis/post-log-like.api.ts
// Purpose: toggle like on a log entry (POST /v1/api/log/:id/like).
// Returns TLogLikeState {liked, likeCount}. Backend is idempotent (toggle).
// Constraints: auth required. id stays STRING (BIGINT-safe). Unwraps envelope once.

import { clientRequest } from '@/apis/http.client';
import type { TLogLikeState } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogLikeState;
}

export async function postLogLike(
    token: string,
    logId: string
): Promise<TLogLikeState> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/${encodeURIComponent(logId)}/like`,
        method: 'POST',
        token,
        fallbackError: 'Failed to toggle log like',
    });
    return envelope.data;
}
