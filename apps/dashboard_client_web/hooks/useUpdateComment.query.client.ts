// hooks/useUpdateComment.query.client.ts
// Purpose: TanStack Query mutation that edits a comment's body, then refetches
//   the post's comment tree. Optimistic patch: the cached row's body is replaced
//   and updatedAt bumped in place so the "(edited)" hint shows immediately; the
//   server result reconciles on settle.
// Constraints: requires a Clerk token; ids stay STRINGS. The cache is
//   InfiniteData<TCommentListResponse> — the body patch is applied across every
//   page's comments array (mirrors useDeleteComment's page-mapping).

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { updateComment } from '@/apis/updateComment.api';
import { commentsQueryKey } from '@/hooks/useComments.query.client';
import type { TComment, TCommentListResponse } from '@repo/types';

type TInput = { commentId: string; body: string };
type TCache = InfiniteData<TCommentListResponse>;
type TContext = { previous?: TCache };

export function useUpdateComment(postId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = commentsQueryKey(postId);

    return useMutation<TComment, Error, TInput, TContext>({
        mutationFn: async ({ commentId, body }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return updateComment(token, commentId, body);
        },
        onMutate: async ({ commentId, body }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<TCache>(key);
            if (previous) {
                const now = new Date().toISOString();
                const pages = previous.pages.map((page) => ({
                    ...page,
                    comments: page.comments.map((c) =>
                        c.id === commentId ? { ...c, body, updatedAt: now } : c
                    ),
                }));
                queryClient.setQueryData<TCache>(key, {
                    ...previous,
                    pages,
                });
            }
            return { previous };
        },
        onError: (_error, _input, context) => {
            if (context?.previous) {
                queryClient.setQueryData(key, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: key });
        },
    });
}
