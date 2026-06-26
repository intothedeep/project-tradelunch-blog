// apis/signImageUpload.api.ts
// Purpose: request a Supabase Storage signed-upload URL for an editor image.
// Constraints: requires a Clerk bearer token. Returns ApiError on non-2xx; a
// 503 status specifically signals "storage not configured" (the bucket is a
// per-user gate) and callers should degrade gracefully on that case.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TImageSignRequest, TImageSignResponse } from '@repo/types';

export async function signImageUpload(
    token: string,
    body: TImageSignRequest
): Promise<TImageSignResponse> {
    try {
        return await axios_instance.post<unknown, TImageSignResponse>(
            '/v1/api/posts/images/sign',
            body,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to sign image upload');
    }
}
