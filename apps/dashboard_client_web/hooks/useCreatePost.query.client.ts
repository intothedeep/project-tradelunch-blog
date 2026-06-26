// hooks/useCreatePost.query.client.ts
// Purpose: TanStack Query mutation over createPost, injecting the Clerk token.
// Invalidates the drafts cache on success.
// Constraints: rejects with ApiError on non-2xx for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '@/apis/createPost.api';
import { myDraftsQueryKey } from '@/hooks/useMyDrafts.query.client';
import type { TPostInput, TDraftSummary } from '@repo/types';

export function useCreatePost() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<TDraftSummary, Error, TPostInput>({
        mutationFn: async (input: TPostInput) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return createPost(token, input);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: myDraftsQueryKey });
        },
    });
}
