// apis/getMyDrafts.api.ts
// Purpose: list the authenticated user's drafts.
// Constraints: requires a Clerk bearer token; non-2xx surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TDraftSummary } from '@repo/types';

export async function getMyDrafts(token: string): Promise<TDraftSummary[]> {
    try {
        return await axios_instance.get<unknown, TDraftSummary[]>(
            '/v1/api/users/me/drafts',
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to load drafts');
    }
}
