// hooks/useSetAdminPostStatus.query.client.ts
// Purpose: mutation over the admin-moderation Server Action; the action resolves
// the Clerk token server-side and revalidates the feed tags. Invalidates the
// admin posts list (RQ owns its client lists) on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAdminPostStatusAction } from '@/app/actions/postPublish.action';
import { adminPostsQueryKey } from '@/hooks/useAdminPosts.query.client';
import type { TPostStatus } from '@repo/types';

export interface TSetAdminPostStatusVars {
    // BIGINT post id as a STRING (Snowflake precision); never Number() it.
    postId: string;
    status: TPostStatus;
    // Post author's username — threads into the feed:<username> tag so the
    // author's cached feed revalidates alongside feed:global.
    username: string;
}

export function useSetAdminPostStatus() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, TSetAdminPostStatusVars>({
        mutationFn: async ({ postId, status, username }) =>
            setAdminPostStatusAction(postId, status, username),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminPostsQueryKey });
        },
    });
}
