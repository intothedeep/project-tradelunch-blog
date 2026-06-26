// hooks/useDeleteAdminPost.query.client.ts
// Purpose: mutation over deleteAdminPost, injecting the Clerk token;
// invalidates the admin posts list on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAdminPost } from '@/apis/deleteAdminPost.api';
import { adminPostsQueryKey } from '@/hooks/useAdminPosts.query.client';

export function useDeleteAdminPost() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, number>({
        mutationFn: async (postId: number) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return deleteAdminPost(token, postId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminPostsQueryKey });
        },
    });
}
