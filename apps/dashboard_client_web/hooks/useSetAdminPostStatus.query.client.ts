// hooks/useSetAdminPostStatus.query.client.ts
// Purpose: mutation over setAdminPostStatus, injecting the Clerk token;
// invalidates the admin posts list on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAdminPostStatus } from '@/apis/setAdminPostStatus.api';
import { adminPostsQueryKey } from '@/hooks/useAdminPosts.query.client';
import type { TPostStatus } from '@repo/types';

export interface TSetAdminPostStatusVars {
    postId: number;
    status: TPostStatus;
}

export function useSetAdminPostStatus() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, TSetAdminPostStatusVars>({
        mutationFn: async ({ postId, status }: TSetAdminPostStatusVars) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return setAdminPostStatus(token, postId, status);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminPostsQueryKey });
        },
    });
}
