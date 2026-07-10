// hooks/useLogGlobalStream.query.client.ts
// Purpose: TanStack useInfiniteQuery over getLogGlobalStream — the GLOBAL /log
//   discovery feed (all users' top-level logs, keyset newest-first). Seeded from
//   a server-fetched first page so the RSC paints instantly.
// Constraints: id/cursor stay STRINGS. Cache shape: InfiniteData<TLogStreamResponse>.

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getLogGlobalStream } from '@/apis/get-log-global.api';
import type { TLogStreamResponse } from '@repo/types';

// Constant key (no username) — the single global feed cache.
export const logGlobalStreamQueryKey = () => ['log', 'global'] as const;

const PAGE_LIMIT = 20;

export function useLogGlobalStream(initialData?: TLogStreamResponse) {
    const query = useInfiniteQuery<TLogStreamResponse>({
        queryKey: logGlobalStreamQueryKey(),
        queryFn: ({ pageParam }) =>
            getLogGlobalStream({
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
