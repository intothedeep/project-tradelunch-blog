// hooks/useCreateComment.query.client.ts
// Purpose: TanStack Query mutation that creates a comment/reply, then refetches
//   the post's comment tree. Optimistic insert (Option C): the new reply is
//   appended to the cached flat array nested under its ACTUAL clicked parent —
//   depth = parent.depth + 1, path = parent.path || tempId — so nothing
//   re-parents or flattens; the server result reconciles on settle.
// Constraints: requires a Clerk token; post/parent ids stay STRINGS. The cache
//   is InfiniteData<TCommentListResponse> — the optimistic node is inserted in
//   pre-order INTO the page that owns its parent (or the first page for a new
//   root), so paging boundaries and reply nesting both survive.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { createComment } from '@/apis/createComment.api';
import { commentsQueryKey } from '@/hooks/useComments.query.client';
import type { TComment, TCommentListResponse } from '@repo/types';

type TInput = { body: string; parentId?: string | null };
type TCache = InfiniteData<TCommentListResponse>;
type TContext = { previous?: TCache };

// Build an optimistic comment nested under its actual parent (or top-level).
function buildOptimistic(
    tempId: string,
    parent: TComment | undefined,
    body: string
): TComment {
    const now = new Date().toISOString();
    return {
        id: tempId,
        postId: parent?.postId ?? '',
        userId: '',
        parentId: parent?.id ?? null,
        path: parent ? [...parent.path, tempId] : [tempId],
        depth: parent ? parent.depth + 1 : 0,
        body,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
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

// Repack the optimistic node into the infinite-page shape: a reply goes into the
// page whose comments contain its parent (pre-order within that page); a new
// root goes into the first page (roots are newest-first). Falls back to the
// first page when no parent is found anywhere.
function insertIntoPages(cache: TCache, node: TComment): TCache {
    const pages = cache.pages;
    if (pages.length === 0) {
        return {
            ...cache,
            pages: [{ comments: [node], nextCursor: null, hasMore: false }],
            pageParams: cache.pageParams.length
                ? cache.pageParams
                : [undefined],
        };
    }

    let targetIdx = 0;
    if (node.parentId !== null) {
        const found = pages.findIndex((p) =>
            p.comments.some((c) => c.id === node.parentId)
        );
        targetIdx = found >= 0 ? found : 0;
    }

    const nextPages = pages.map((page, i) =>
        i === targetIdx
            ? { ...page, comments: insertInPreOrder(page.comments, node) }
            : page
    );
    return { ...cache, pages: nextPages };
}

export function useCreateComment(postId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = commentsQueryKey(postId);

    return useMutation<TComment, Error, TInput, TContext>({
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
            const previous = queryClient.getQueryData<TCache>(key);
            const flat = previous?.pages.flatMap((p) => p.comments) ?? [];
            const parent = parentId
                ? flat.find((c) => c.id === parentId)
                : undefined;
            const optimistic = buildOptimistic(
                `temp-${Date.now()}`,
                parent,
                body
            );
            if (previous) {
                queryClient.setQueryData<TCache>(
                    key,
                    insertIntoPages(previous, optimistic)
                );
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
