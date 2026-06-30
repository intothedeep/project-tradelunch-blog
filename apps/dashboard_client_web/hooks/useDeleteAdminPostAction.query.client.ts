// hooks/useDeleteAdminPostAction.query.client.ts
// Purpose: mutation over the deleteAdminPostAction Server Action, which
// soft-deletes the post AND revalidates the feed tags server-side; also
// invalidates the client admin posts list on success so the table updates.
// Constraints: no client token handling — the Server Action resolves Clerk
// auth server-side. Rejects with Error on failure for inline handling.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAdminPostAction } from '@/app/actions/postPublish.action';
import { adminPostsQueryKey } from '@/hooks/useAdminPosts.query.client';

export function useDeleteAdminPostAction() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { postId: string; username: string }>({
        mutationFn: ({ postId, username }) =>
            deleteAdminPostAction(postId, username),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminPostsQueryKey });
        },
    });
}
