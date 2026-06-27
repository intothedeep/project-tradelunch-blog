// hooks/useCreateComment.query.client.ts
// Purpose: TanStack Query mutation that creates a comment/reply, then refetches
//   the post's comment tree. Optimistic insert (Option C): the new reply is
//   appended to the cached flat array nested under its ACTUAL clicked parent —
//   depth = parent.depth + 1, path = parent.path || tempId — so nothing
//   re-parents or flattens; the server result reconciles on settle.
// Constraints: requires a Clerk token; post/parent ids stay STRINGS.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment } from '@/apis/createComment.api';
import { commentsQueryKey } from '@/hooks/useComments.query.client';
import type { TComment } from '@repo/types';

type TInput = { body: string; parentId?: string | null };

// Build an optimistic comment nested under its actual parent (or top-level).
function buildOptimistic(
    tempId: string,
    parent: TComment | undefined,
    body: string
): TComment {
    return {
        id: tempId,
        postId: parent?.postId ?? '',
        userId: '',
        parentId: parent?.id ?? null,
        path: parent ? [...parent.path, tempId] : [tempId],
        depth: parent ? parent.depth + 1 : 0,
        body,
        isDeleted: false,
        createdAt: new Date().toISOString(),
    };
}

// Insert `node` immediately AFTER the last row of its parent's subtree so the
// flat array stays in pre-order; top-level nodes append at the end.
function insertInPreOrder(list: TComment[], node: TComment): TComment[] {
    if (node.parentId === null) return [...list, node];
    const parentIdx = list.findIndex((c) => c.id === node.parentId);
    if (parentIdx < 0) return [...list, node];
    let insertAt = parentIdx + 1;
    const parentDepth = list[parentIdx]!.depth;
    while (insertAt < list.length && list[insertAt]!.depth > parentDepth) {
        insertAt += 1;
    }
    return [...list.slice(0, insertAt), node, ...list.slice(insertAt)];
}

export function useCreateComment(postId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = commentsQueryKey(postId);

    return useMutation<TComment, Error, TInput, { previous?: TComment[] }>({
        mutationFn: async ({ body, parentId }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return createComment(token, postId, {
                body,
                parentId: parentId ?? null,
            });
        },
        onMutate: async ({ body, parentId }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<TComment[]>(key);
            const list = previous ?? [];
            const parent = parentId
                ? list.find((c) => c.id === parentId)
                : undefined;
            const optimistic = buildOptimistic(
                `temp-${Date.now()}`,
                parent,
                body
            );
            queryClient.setQueryData<TComment[]>(
                key,
                insertInPreOrder(list, optimistic)
            );
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
