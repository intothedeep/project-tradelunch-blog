// apis/post-follow.api.ts
// Purpose: toggle follow on a user (POST /v1/api/follow/:username).
//   Backend is idempotent toggle (soft-delete via deleted_at).
//   Self-follow returns 400 — callers must prevent the self-view button.
//   Returns TLogFollowState {following, followerCount, followeeCount}.
//   503 until migration 0024 applied — callers handle gracefully.
// Constraints: auth required. Unwraps {success, data} once.

import { clientRequest } from '@/apis/http.client';
import type { TLogFollowState } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogFollowState;
}

export async function postFollow(
    token: string,
    username: string
): Promise<TLogFollowState> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/follow/${encodeURIComponent(username)}`,
        method: 'POST',
        token,
        fallbackError: 'Failed to toggle follow',
    });
    return envelope.data;
}
