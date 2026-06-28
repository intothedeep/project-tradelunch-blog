// hooks/useUpdatePost.query.client.ts
// Purpose: TanStack Query mutation over updatePost, injecting the Clerk token.
// Invalidates the drafts cache on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePost } from '@/apis/updatePost.api';
import { myDraftsQueryKey } from '@/hooks/useMyDrafts.query.client';
import type { TPostInput, TDraftSummary } from '@repo/types';

export interface TUpdatePostVars {
    postId: string;
    input: Partial<TPostInput>;
}

export function useUpdatePost() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<TDraftSummary, Error, TUpdatePostVars>({
        mutationFn: async ({ postId, input }: TUpdatePostVars) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return updatePost(token, postId, input);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: myDraftsQueryKey });
        },
    });
}
