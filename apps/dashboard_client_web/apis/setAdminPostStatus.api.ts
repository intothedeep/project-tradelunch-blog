// apis/setAdminPostStatus.api.ts
// Purpose: change a post's visibility status as an admin (moderation).
// Constraints: requires a Clerk bearer token; non-admin → 403; non-2xx
// surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TAdminPostStatusInput, TPostStatus } from '@repo/types';

export async function setAdminPostStatus(
    token: string,
    postId: number,
    status: TPostStatus
): Promise<void> {
    try {
        const body: TAdminPostStatusInput = { status };
        await axios_instance.patch<unknown, void>(
            `/v1/api/admin/posts/${postId}/status`,
            body,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to update post status');
    }
}
