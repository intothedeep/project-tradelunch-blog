// hooks/useCreateLog.query.client.ts
// Purpose: TanStack mutation to create a log entry with optimistic insert.
//   - Top-level (parentId=null): prepend temp node to stream cache.
//   - Reply (parentId=string): prepend temp node to thread children cache.
//   On 201 success: invalidate to reconcile temp id → real server id.
//   On error: rollback to previous cache snapshot.
// Constraints: requires Clerk token. temp id is a STRING. Never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import { postLog } from '@/apis/post-log.api';
import { logStreamQueryKey } from '@/hooks/useLogStream.query.client';
import { logThreadQueryKey } from '@/hooks/useLogThread.query.client';
import type {
    TLog,
    TLogCreateRequest,
    TLogStreamResponse,
    TLogThreadResponse,
} from '@repo/types';

type TContext = {
    previousStream?: InfiniteData<TLogStreamResponse>;
    previousThread?: InfiniteData<TLogThreadResponse>;
};

function buildOptimistic(
    tempId: string,
    input: TLogCreateRequest,
    authorName: string | undefined
): TLog {
    const parentDepth = 0; // depth is computed from path; estimate only for optimistic
    return {
        id: tempId,
        userId: '',
        parentId: input.parentId,
        path: input.parentId ? [input.parentId, tempId] : [tempId],
        depth: input.parentId ? parentDepth + 1 : 0,
        body: input.body,
        isDeleted: false,
        authorName,
        createdAt: new Date().toISOString(),
    };
}

export function useCreateLog(
    username: string,
    logId?: string // present when in a thread focus view
) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const streamKey = logStreamQueryKey(username);
    const threadKey = logId ? logThreadQueryKey(logId) : null;

    return useMutation<TLog, Error, TLogCreateRequest, TContext>({
        mutationFn: async (input) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return postLog(token, input);
        },
        onMutate: async (input) => {
            const tempId = `temp-${Date.now()}`;

            // Resolve author name from cached /me data (best-effort).
            const meData = queryClient.getQueryData<{
                username?: string | null;
            }>(['users', 'me']);
            const authorName = meData?.username ?? undefined;
            const optimistic = buildOptimistic(tempId, input, authorName);

            let previousStream: InfiniteData<TLogStreamResponse> | undefined;
            let previousThread: InfiniteData<TLogThreadResponse> | undefined;

            if (input.parentId === null) {
                // Top-level: prepend to stream cache.
                await queryClient.cancelQueries({ queryKey: streamKey });
                previousStream =
                    queryClient.getQueryData<InfiniteData<TLogStreamResponse>>(
                        streamKey
                    );
                if (previousStream) {
                    const pages = previousStream.pages.map((page, i) =>
                        i === 0
                            ? { ...page, items: [optimistic, ...page.items] }
                            : page
                    );
                    queryClient.setQueryData<InfiniteData<TLogStreamResponse>>(
                        streamKey,
                        { ...previousStream, pages }
                    );
                }
            } else if (threadKey) {
                // Reply: prepend to children of thread cache.
                await queryClient.cancelQueries({ queryKey: threadKey });
                previousThread =
                    queryClient.getQueryData<InfiniteData<TLogThreadResponse>>(
                        threadKey
                    );
                if (previousThread) {
                    const pages = previousThread.pages.map((page, i) =>
                        i === 0
                            ? {
                                  ...page,
                                  children: {
                                      ...page.children,
                                      items: [
                                          optimistic,
                                          ...page.children.items,
                                      ],
                                  },
                              }
                            : page
                    );
                    queryClient.setQueryData<InfiniteData<TLogThreadResponse>>(
                        threadKey,
                        { ...previousThread, pages }
                    );
                }
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
        onSettled: (_data, _error, input) => {
            if (input.parentId === null) {
                void queryClient.invalidateQueries({ queryKey: streamKey });
            } else if (threadKey) {
                void queryClient.invalidateQueries({ queryKey: threadKey });
            }
        },
    });
}
