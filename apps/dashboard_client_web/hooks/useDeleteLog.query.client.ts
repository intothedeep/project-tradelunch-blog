// hooks/useDeleteLog.query.client.ts
// Purpose: TanStack mutation to soft-delete a log entry with optimistic tombstone.
//   Masks the entry in-place (body="[deleted]", isDeleted=true, authorName=undefined)
//   across both stream and thread caches. Invalidates on settle to reconcile.
// Constraints: requires Clerk token. id stays STRING. Never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { deleteLog } from '@/apis/delete-log.api';
import { logStreamQueryKey } from '@/hooks/useLogStream.query.client';
import { logThreadQueryKey } from '@/hooks/useLogThread.query.client';
import type { TLog, TLogStreamResponse, TLogThreadResponse } from '@repo/types';

type TInput = { logId: string };
type TContext = {
    previousStream?: InfiniteData<TLogStreamResponse>;
    previousThread?: InfiniteData<TLogThreadResponse>;
};

function tombstone(entry: TLog): TLog {
    return {
        ...entry,
        body: '[deleted]',
        isDeleted: true,
        authorName: undefined,
    };
}

function maskInStream(
    cache: InfiniteData<TLogStreamResponse>,
    logId: string
): InfiniteData<TLogStreamResponse> {
    const pages = cache.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
            item.id === logId ? tombstone(item) : item
        ),
    }));
    return { ...cache, pages };
}

function maskInThread(
    cache: InfiniteData<TLogThreadResponse>,
    logId: string
): InfiniteData<TLogThreadResponse> {
    const pages = cache.pages.map((page) => ({
        ...page,
        focus: page.focus.id === logId ? tombstone(page.focus) : page.focus,
        ancestors: page.ancestors.map((a) =>
            a.id === logId ? tombstone(a) : a
        ),
        children: {
            ...page.children,
            items: page.children.items.map((c) =>
                c.id === logId ? tombstone(c) : c
            ),
        },
    }));
    return { ...cache, pages };
}

export function useDeleteLog(username: string, logId?: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const streamKey = logStreamQueryKey(username);
    const threadKey = logId ? logThreadQueryKey(logId) : null;

    return useMutation<TLog, Error, TInput, TContext>({
        mutationFn: async ({ logId: id }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return deleteLog(token, id);
        },
        onMutate: async ({ logId: id }) => {
            await queryClient.cancelQueries({ queryKey: streamKey });
            if (threadKey) {
                await queryClient.cancelQueries({ queryKey: threadKey });
            }

            const previousStream =
                queryClient.getQueryData<InfiniteData<TLogStreamResponse>>(
                    streamKey
                );
            const previousThread = threadKey
                ? queryClient.getQueryData<InfiniteData<TLogThreadResponse>>(
                      threadKey
                  )
                : undefined;

            if (previousStream) {
                queryClient.setQueryData(
                    streamKey,
                    maskInStream(previousStream, id)
                );
            }
            if (previousThread && threadKey) {
                queryClient.setQueryData(
                    threadKey,
                    maskInThread(previousThread, id)
                );
            }

            return { previousStream, previousThread };
        },
        onError: (_error, _input, context) => {
            if (context?.previousStream) {
                queryClient.setQueryData(streamKey, context.previousStream);
            }
            if (context?.previousThread && threadKey) {
                queryClient.setQueryData(threadKey, context.previousThread);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: streamKey });
            if (threadKey) {
                void queryClient.invalidateQueries({ queryKey: threadKey });
            }
        },
    });
}
