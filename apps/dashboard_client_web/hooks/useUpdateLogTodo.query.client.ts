// hooks/useUpdateLogTodo.query.client.ts
// Purpose: TanStack mutation to update todo fields on a log entry (PATCH …/todo).
//   Optimistic: updates the entry in stream and todos caches immediately,
//   rolls back on error, invalidates stream + todos on settle.
// Constraints: "use client". id stays STRING. Never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { patchLogTodo } from '@/apis/patch-log-todo.api';
import { logStreamQueryKey } from '@/hooks/useLogStream.query.client';
import { logTodosQueryKey } from '@/hooks/useLogTodos.query.client';
import type {
    TLog,
    TLogTodoUpdateRequest,
    TLogStreamResponse,
    TLogTodoListResponse,
} from '@repo/types';

type TInput = { logId: string; update: TLogTodoUpdateRequest };

type TContext = {
    previousStream?: InfiniteData<TLogStreamResponse>;
    previousTodos?: InfiniteData<TLogTodoListResponse>;
};

// Merge todo fields into an existing TLog node optimistically.
function applyTodoUpdate(log: TLog, update: TLogTodoUpdateRequest): TLog {
    const next = { ...log };

    if (update.dueAt !== undefined) {
        // null = clear todo; string = set
        next.dueAt = update.dueAt;
        if (update.dueAt === null) {
            next.doneAt = undefined;
            next.todoStatus = undefined;
        }
    }

    if (update.done !== undefined) {
        next.doneAt = update.done ? new Date().toISOString() : undefined;
    }

    // Derive todoStatus optimistically (mirrors deriveLogStatus on backend).
    if (next.dueAt != null) {
        if (next.doneAt != null) {
            next.todoStatus = 'done';
        } else if (new Date(next.dueAt) < new Date()) {
            next.todoStatus = 'overdue';
        } else {
            next.todoStatus = 'todo';
        }
    } else {
        next.todoStatus = undefined;
    }

    return next;
}

function patchInStream(
    cache: InfiniteData<TLogStreamResponse>,
    logId: string,
    update: TLogTodoUpdateRequest
): InfiniteData<TLogStreamResponse> {
    const pages = cache.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
            item.id === logId ? applyTodoUpdate(item, update) : item
        ),
    }));
    return { ...cache, pages };
}

function patchInTodos(
    cache: InfiniteData<TLogTodoListResponse>,
    logId: string,
    update: TLogTodoUpdateRequest
): InfiniteData<TLogTodoListResponse> {
    const pages = cache.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
            item.id === logId ? applyTodoUpdate(item, update) : item
        ),
    }));
    return { ...cache, pages };
}

export function useUpdateLogTodo(username: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const streamKey = logStreamQueryKey(username);
    // Invalidate all todo queries for this user regardless of status filter.
    const todosBaseKey = logTodosQueryKey(username);

    return useMutation<TLog, Error, TInput, TContext>({
        mutationFn: async ({ logId, update }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return patchLogTodo(token, logId, update);
        },
        onMutate: async ({ logId, update }) => {
            await queryClient.cancelQueries({ queryKey: streamKey });
            await queryClient.cancelQueries({ queryKey: todosBaseKey });

            const previousStream =
                queryClient.getQueryData<InfiniteData<TLogStreamResponse>>(
                    streamKey
                );

            // Find any todos cache pages (any status).
            const previousTodos =
                queryClient.getQueryData<InfiniteData<TLogTodoListResponse>>(
                    todosBaseKey
                );

            if (previousStream) {
                queryClient.setQueryData(
                    streamKey,
                    patchInStream(previousStream, logId, update)
                );
            }
            if (previousTodos) {
                queryClient.setQueryData(
                    todosBaseKey,
                    patchInTodos(previousTodos, logId, update)
                );
            }

            return { previousStream, previousTodos };
        },
        onError: (_error, _input, context) => {
            if (context?.previousStream) {
                queryClient.setQueryData(streamKey, context.previousStream);
            }
            if (context?.previousTodos) {
                queryClient.setQueryData(todosBaseKey, context.previousTodos);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: streamKey });
            void queryClient.invalidateQueries({ queryKey: todosBaseKey });
        },
    });
}
