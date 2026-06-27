// hooks/useComments.query.client.ts
// Purpose: TanStack useInfiniteQuery over getComments — the PUBLIC comment tree
//   for a post, paginated 50 ROOT comments per page (each page a flat pre-order
//   array incl. subtrees). Seeded from a server-fetched first page so the RSC
//   paints instantly; refetches reconcile after create/delete invalidate. A
//   bottom "Load more" control drives fetchNextPage.
// Constraints: public read (no token). post/comment ids stay STRINGS. The cache
//   shape is InfiniteData<TCommentListResponse>; optimistic updaters must match.

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getComments } from '@/apis/getComments.api';
import type { TCommentListResponse } from '@repo/types';

export const commentsQueryKey = (postId: string) =>
    ['comments', postId] as const;

const PAGE_LIMIT = 50;

export function useComments(
    postId: string,
    initialData?: TCommentListResponse
) {
    const query = useInfiniteQuery<TCommentListResponse>({
        queryKey: commentsQueryKey(postId),
        queryFn: ({ pageParam }) =>
            getComments(postId, {
                cursor: pageParam as string | undefined,
                limit: PAGE_LIMIT,
            }),
        initialPageParam: undefined,
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
        initialData: initialData
            ? { pages: [initialData], pageParams: [undefined] }
            : undefined,
    });

    const comments = query.data?.pages.flatMap((p) => p.comments) ?? [];

    return {
        comments,
        isError: query.isError,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
}
