// apis/deleteAdminPost.api.ts
// Purpose: soft-delete any post as an admin (moderation).
// Constraints: requires a Clerk bearer token; non-admin → 403; non-2xx
// surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';

export async function deleteAdminPost(
    token: string,
    postId: string
): Promise<void> {
    try {
        await axios_instance.delete<unknown, void>(
            `/v1/api/admin/posts/${postId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to delete post');
    }
}
