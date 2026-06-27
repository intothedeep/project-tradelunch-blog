// hooks/useDeleteComment.query.client.ts
// Purpose: TanStack Query mutation that soft-deletes a comment, then refetches
//   the post's comment tree. Optimistic tombstone: the cached row's body is
//   masked to "[deleted]" + isDeleted=true in place (the row + its children
//   survive — never removed); the server result reconciles on settle.
// Constraints: requires a Clerk token; ids stay STRINGS. The cache is
//   InfiniteData<TCommentListResponse> — the tombstone spread is applied across
//   every page's comments array.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { deleteComment } from '@/apis/deleteComment.api';
import { commentsQueryKey } from '@/hooks/useComments.query.client';
import type { TComment, TCommentListResponse } from '@repo/types';

type TInput = { commentId: string };
type TCache = InfiniteData<TCommentListResponse>;
type TContext = { previous?: TCache };

export function useDeleteComment(postId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = commentsQueryKey(postId);

    return useMutation<TComment, Error, TInput, TContext>({
        mutationFn: async ({ commentId }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return deleteComment(token, commentId);
        },
        onMutate: async ({ commentId }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<TCache>(key);
            if (previous) {
                const pages = previous.pages.map((page) => ({
                    ...page,
                    comments: page.comments.map((c) =>
                        c.id === commentId
                            ? {
                                  ...c,
                                  body: '[deleted]',
                                  isDeleted: true,
                                  authorName: undefined,
                              }
                            : c
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
