// hooks/useLogTodos.query.client.ts
// Purpose: TanStack useInfiniteQuery for owner's todo log entries.
//   Uses compound keyset (due_at|id) STRING cursor from GET /v1/api/log/todos.
//   Requires a Clerk bearer token — owner-only endpoint.
// Constraints: "use client". cursor stays STRING. Never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getLogTodos, type TLogTodoStatus } from '@/apis/get-log-todos.api';
import type { TLogTodoListResponse } from '@repo/types';

export const logTodosQueryKey = (username: string, status?: TLogTodoStatus) =>
    status
        ? (['log', 'todos', username, status] as const)
        : (['log', 'todos', username] as const);

const PAGE_LIMIT = 20;

export function useLogTodos(username: string, status: TLogTodoStatus = 'all') {
    const { getToken } = useAuth();

    const query = useInfiniteQuery<TLogTodoListResponse>({
        queryKey: logTodosQueryKey(username, status),
        queryFn: async ({ pageParam }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getLogTodos(token, {
                status,
                cursor: pageParam as string | undefined,
                limit: PAGE_LIMIT,
            });
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    });

    const items = query.data?.pages.flatMap((p) => p.items) ?? [];
    // counts come from the most recent page (server sends aggregate counts).
    const counts = query.data?.pages[query.data.pages.length - 1]?.counts ?? {
        todo: 0,
        overdue: 0,
        done: 0,
    };

    return {
        items,
        counts,
        isLoading: query.isLoading,
        isError: query.isError,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
    };
}
