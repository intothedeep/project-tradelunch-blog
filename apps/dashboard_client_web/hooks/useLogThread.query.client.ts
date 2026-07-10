// hooks/useLogThread.query.client.ts
// Purpose: TanStack useInfiniteQuery for the focus-node thread view.
//   Page 1 = full TLogThreadResponse (ancestors + focus + first children page).
//   Subsequent pages = additional children only, via nextCursor.
//   The hook exposes ancestors, focus, and a flat children list for rendering.
// Constraints: id/cursor stay STRINGS. Cache shape: InfiniteData<TLogThreadResponse>.

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getLogThread } from '@/apis/get-log-thread.api';
import type { TLog, TLogThreadResponse } from '@repo/types';

export const logThreadQueryKey = (logId: string) =>
    ['log', 'thread', logId] as const;

const PAGE_LIMIT = 20;

export function useLogThread(logId: string, initialData?: TLogThreadResponse) {
    const query = useInfiniteQuery<TLogThreadResponse>({
        queryKey: logThreadQueryKey(logId),
        // Page 1: no cursor — server returns ancestors + focus + first children.
        // Page N+: pass childrenCursor from the last page's children.nextCursor.
        queryFn: ({ pageParam }) => {
            if (pageParam === undefined) {
                return getLogThread(logId, { limit: PAGE_LIMIT });
            }
            return getLogThread(logId, {
                childrenCursor: pageParam as string,
                limit: PAGE_LIMIT,
            });
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) =>
            lastPage.children.hasMore
                ? (lastPage.children.nextCursor ?? undefined)
                : undefined,
        initialData: initialData
            ? { pages: [initialData], pageParams: [undefined] }
            : undefined,
    });

    // ancestors and focus come from page 1 (stable across pages).
    const firstPage = query.data?.pages[0];
    const ancestors: TLog[] = firstPage?.ancestors ?? [];
    const focus: TLog | undefined = firstPage?.focus;

    // Flatten children across all pages (dedup by id for robustness).
    const seen = new Set<string>();
    const children: TLog[] = [];
    for (const page of query.data?.pages ?? []) {
        for (const item of page.children.items) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                children.push(item);
            }
        }
    }

    return {
        ancestors,
        focus,
        children,
        isError: query.isError,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
}
