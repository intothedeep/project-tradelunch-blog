// apis/deletePost.api.ts
// Purpose: soft-delete an owned post.
// Constraints: requires a Clerk bearer token; 404 when not owner; non-2xx
// surfaces as ApiError.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';

export async function deletePost(token: string, postId: string): Promise<void> {
    try {
        await axios_instance.delete<unknown, void>(`/v1/api/posts/${postId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        throw toApiError(error, 'Failed to delete post');
    }
}
