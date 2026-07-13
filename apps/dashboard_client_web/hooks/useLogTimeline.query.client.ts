// hooks/useLogTimeline.query.client.ts
// Purpose: TanStack useInfiniteQuery over getLogTimeline — viewer's followed-user
//   feed, keyset-paginated newest-first. Requires auth (enabled when signed-in).
//   Graceful dormant: returns empty when backend returns 503 (migration 0024 not
//   yet applied) — the empty state covers this case.
// Constraints: "use client". id/cursor stay STRINGS (BIGINT-safe).

'use client';

import { useAuth } from '@clerk/nextjs';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getLogTimeline } from '@/apis/get-log-timeline.api';
import type { TLogTimelineResponse } from '@repo/types';

// Constant key — single viewer-scoped timeline cache.
export const logTimelineQueryKey = () => ['log', 'timeline'] as const;

const PAGE_LIMIT = 20;

export function useLogTimeline() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const query = useInfiniteQuery<TLogTimelineResponse>({
        queryKey: logTimelineQueryKey(),
        queryFn: async ({ pageParam }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getLogTimeline(token, {
                cursor: pageParam as string | undefined,
                limit: PAGE_LIMIT,
            });
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
        enabled: isLoaded && isSignedIn === true,
        // On 503 (feature dormant), treat as empty rather than error.
        retry: false,
    });

    const items = query.data?.pages.flatMap((p) => p.items) ?? [];

    return {
        items,
        isLoading: query.isLoading,
        isError: query.isError,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
}
