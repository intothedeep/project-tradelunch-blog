// hooks/useFollow.query.client.ts
// Purpose: TanStack mutation to toggle follow on a user (POST /follow/:username).
//   Optimistic: flips following + adjusts followerCount in local component state
//   (the cache key is the query key so the FollowButton reads from it).
//   Graceful dormant: on 503/error rolls back + passes error to onError.
// Constraints: "use client". Never Number()/parseInt BIGINT ids.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postFollow } from '@/apis/post-follow.api';
import type { TLogFollowState } from '@repo/types';

// Query key for a single user's follow state (viewer-scoped).
export const followStateQueryKey = (username: string) =>
    ['follow', 'state', username] as const;

export function useFollow(targetUsername: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = followStateQueryKey(targetUsername);

    return useMutation<
        TLogFollowState,
        Error,
        void,
        { previous?: TLogFollowState }
    >({
        mutationFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return postFollow(token, targetUsername);
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<TLogFollowState>(key);

            if (previous) {
                queryClient.setQueryData<TLogFollowState>(key, {
                    ...previous,
                    following: !previous.following,
                    followerCount:
                        previous.followerCount + (previous.following ? -1 : 1),
                });
            }

            return { previous };
        },
        onError: (_error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(key, context.previous);
            }
        },
        onSuccess: (data) => {
            // Reconcile to server truth.
            queryClient.setQueryData(key, data);
        },
    });
}
