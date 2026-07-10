// hooks/useLogStream.query.client.ts
// Purpose: TanStack useInfiniteQuery over getLogStream — per-user top-level log
//   feed, keyset paginated newest-first. Seeded from a server-fetched first page
//   so the RSC paints instantly; subsequent pages via "Load more".
// Constraints: id/cursor stay STRINGS. Cache shape: InfiniteData<TLogStreamResponse>.

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getLogStream } from '@/apis/get-log-stream.api';
import type { TLogStreamResponse } from '@repo/types';

export const logStreamQueryKey = (username: string) =>
    ['log', 'stream', username] as const;

const PAGE_LIMIT = 20;

export function useLogStream(
    username: string,
    initialData?: TLogStreamResponse
) {
    const query = useInfiniteQuery<TLogStreamResponse>({
        queryKey: logStreamQueryKey(username),
        queryFn: ({ pageParam }) =>
            getLogStream(username, {
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

    const items = query.data?.pages.flatMap((p) => p.items) ?? [];

    return {
        items,
        isError: query.isError,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
}
