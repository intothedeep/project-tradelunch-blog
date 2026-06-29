// hooks/useDeletePost.query.client.ts
// Purpose: mutation over the delete Server Action; the action resolves the Clerk
// token server-side and revalidates the feed tags. Invalidates the drafts cache
// (RQ owns its client lists) on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePostAction } from '@/app/actions/postPublish.action';
import { myDraftsQueryKey } from '@/hooks/useMyDrafts.query.client';

export interface TDeletePostVars {
    // BIGINT post id as a STRING (Snowflake precision); never Number() it.
    postId: string;
    // Post author's username — threads into the feed:<username> tag.
    username: string;
}

export function useDeletePost() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, TDeletePostVars>({
        mutationFn: async ({ postId, username }) =>
            deletePostAction(postId, username),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: myDraftsQueryKey });
        },
    });
}
