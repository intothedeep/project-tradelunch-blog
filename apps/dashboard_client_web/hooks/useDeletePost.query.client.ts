// hooks/useDeletePost.query.client.ts
// Purpose: TanStack Query mutation over deletePost, injecting the Clerk token.
// Invalidates the drafts cache on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePost } from '@/apis/deletePost.api';
import { myDraftsQueryKey } from '@/hooks/useMyDrafts.query.client';

export function useDeletePost() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: async (postId: string) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return deletePost(token, postId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: myDraftsQueryKey });
        },
    });
}
