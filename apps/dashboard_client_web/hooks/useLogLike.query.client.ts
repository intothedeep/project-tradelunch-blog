// hooks/useLogLike.query.client.ts
// Purpose: TanStack mutation to toggle a like on a log entry (POST …/like).
//   Optimistic: flips liked + adjusts likeCount in all three stream caches
//   (per-user stream, global feed, timeline) and thread cache.
//   Rolls back on error. invalidates on settle.
// Constraints: "use client". id stays STRING. Never Number()/parseInt.
//   Feature-dormant safe: likeCount absent = feature not yet on.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { postLogLike } from '@/apis/post-log-like.api';
import { logStreamQueryKey } from '@/hooks/useLogStream.query.client';
import { logGlobalStreamQueryKey } from '@/hooks/useLogGlobalStream.query.client';
import { logTimelineQueryKey } from '@/hooks/useLogTimeline.query.client';
import { logThreadQueryKey } from '@/hooks/useLogThread.query.client';
import type {
    TLog,
    TLogStreamResponse,
    TLogThreadResponse,
    TLogTimelineResponse,
} from '@repo/types';

type TInput = { logId: string; username?: string; threadId?: string };

type TContext = {
    previousStream?: InfiniteData<TLogStreamResponse>;
    previousGlobal?: InfiniteData<TLogStreamResponse>;
    previousTimeline?: InfiniteData<TLogTimelineResponse>;
    previousThread?: InfiniteData<TLogThreadResponse>;
};

function flipLike(log: TLog, nextLiked: boolean): TLog {
    if (log.likeCount === undefined) return log;
    const delta = nextLiked ? 1 : -1;
    return {
        ...log,
        viewerLiked: nextLiked,
        likeCount: Math.max(0, (log.likeCount ?? 0) + delta),
    };
}

function patchStream(
    cache: InfiniteData<TLogStreamResponse>,
    logId: string,
    nextLiked: boolean
): InfiniteData<TLogStreamResponse> {
    return {
        ...cache,
        pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === logId ? flipLike(item, nextLiked) : item
            ),
        })),
    };
}

function patchTimeline(
    cache: InfiniteData<TLogTimelineResponse>,
    logId: string,
    nextLiked: boolean
): InfiniteData<TLogTimelineResponse> {
    return {
        ...cache,
        pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === logId ? flipLike(item, nextLiked) : item
            ),
        })),
    };
}

function patchThread(
    cache: InfiniteData<TLogThreadResponse>,
    logId: string,
    nextLiked: boolean
): InfiniteData<TLogThreadResponse> {
    return {
        ...cache,
        pages: cache.pages.map((page) => ({
            ...page,
            focus:
                page.focus.id === logId
                    ? flipLike(page.focus, nextLiked)
                    : page.focus,
            children: {
                ...page.children,
                items: page.children.items.map((item) =>
                    item.id === logId ? flipLike(item, nextLiked) : item
                ),
            },
        })),
    };
}

export function useLogLike(opts?: { username?: string; threadId?: string }) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<
        { liked: boolean; likeCount: number },
        Error,
        TInput,
        TContext
    >({
        mutationFn: async ({ logId }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return postLogLike(token, logId);
        },
        onMutate: async ({ logId, username, threadId }) => {
            const resolvedUsername = username ?? opts?.username;
            const resolvedThreadId = threadId ?? opts?.threadId;

            const streamKey = resolvedUsername
                ? logStreamQueryKey(resolvedUsername)
                : null;
            const globalKey = logGlobalStreamQueryKey();
            const timelineKey = logTimelineQueryKey();
            const threadKey = resolvedThreadId
                ? logThreadQueryKey(resolvedThreadId)
                : null;

            if (streamKey)
                await queryClient.cancelQueries({ queryKey: streamKey });
            await queryClient.cancelQueries({ queryKey: globalKey });
            await queryClient.cancelQueries({ queryKey: timelineKey });
            if (threadKey)
                await queryClient.cancelQueries({ queryKey: threadKey });

            const previousStream = streamKey
                ? queryClient.getQueryData<InfiniteData<TLogStreamResponse>>(
                      streamKey
                  )
                : undefined;
            const previousGlobal =
                queryClient.getQueryData<InfiniteData<TLogStreamResponse>>(
                    globalKey
                );
            const previousTimeline =
                queryClient.getQueryData<InfiniteData<TLogTimelineResponse>>(
                    timelineKey
                );
            const previousThread = threadKey
                ? queryClient.getQueryData<InfiniteData<TLogThreadResponse>>(
                      threadKey
                  )
                : undefined;

            // Determine current liked state from any available cache.
            let currentLiked = false;
            if (previousStream) {
                const found = previousStream.pages
                    .flatMap((p) => p.items)
                    .find((item) => item.id === logId);
                if (found) currentLiked = found.viewerLiked ?? false;
            } else if (previousThread) {
                const focus = previousThread.pages[0]?.focus;
                currentLiked =
                    (focus?.id === logId ? focus.viewerLiked : undefined) ??
                    false;
            }
            const nextLiked = !currentLiked;

            if (previousStream && streamKey) {
                queryClient.setQueryData(
                    streamKey,
                    patchStream(previousStream, logId, nextLiked)
                );
            }
            if (previousGlobal) {
                queryClient.setQueryData(
                    globalKey,
                    patchStream(previousGlobal, logId, nextLiked)
                );
            }
            if (previousTimeline) {
                queryClient.setQueryData(
                    timelineKey,
                    patchTimeline(previousTimeline, logId, nextLiked)
                );
            }
            if (previousThread && threadKey) {
                queryClient.setQueryData(
                    threadKey,
                    patchThread(previousThread, logId, nextLiked)
                );
            }

            return {
                previousStream,
                previousGlobal,
                previousTimeline,
                previousThread,
            };
        },
        onError: (_error, { username, threadId }, context) => {
            const resolvedUsername = username ?? opts?.username;
            const resolvedThreadId = threadId ?? opts?.threadId;

            if (context?.previousStream && resolvedUsername) {
                queryClient.setQueryData(
                    logStreamQueryKey(resolvedUsername),
                    context.previousStream
                );
            }
            if (context?.previousGlobal) {
                queryClient.setQueryData(
                    logGlobalStreamQueryKey(),
                    context.previousGlobal
                );
            }
            if (context?.previousTimeline) {
                queryClient.setQueryData(
                    logTimelineQueryKey(),
                    context.previousTimeline
                );
            }
            if (context?.previousThread && resolvedThreadId) {
                queryClient.setQueryData(
                    logThreadQueryKey(resolvedThreadId),
                    context.previousThread
                );
            }
        },
        onSettled: (_data, _error, { logId, username, threadId }) => {
            const resolvedUsername = username ?? opts?.username;
            const resolvedThreadId = threadId ?? opts?.threadId;

            if (resolvedUsername) {
                void queryClient.invalidateQueries({
                    queryKey: logStreamQueryKey(resolvedUsername),
                });
            }
            void queryClient.invalidateQueries({
                queryKey: logGlobalStreamQueryKey(),
            });
            void queryClient.invalidateQueries({
                queryKey: logTimelineQueryKey(),
            });
            if (resolvedThreadId) {
                void queryClient.invalidateQueries({
                    queryKey: logThreadQueryKey(resolvedThreadId),
                });
            }
            // Suppress unused-variable warnings — logId is consumed by onMutate.
            void logId;
        },
    });
}
