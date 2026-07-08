// apis/getMyDrafts.api.ts
// Purpose: list the authenticated user's drafts.
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.
//   Express GET /v1/api/users/me/drafts returns { success, data: TDraftSummary[] }.

import { clientRequest } from '@/apis/http.client';
import type { TDraftSummary } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TDraftSummary[];
}

export async function getMyDrafts(token: string): Promise<TDraftSummary[]> {
    const envelope = await clientRequest<TEnvelope>({
        path: '/v1/api/users/me/drafts',
        token,
        fallbackError: 'Failed to load drafts',
    });
    return envelope.data;
}
