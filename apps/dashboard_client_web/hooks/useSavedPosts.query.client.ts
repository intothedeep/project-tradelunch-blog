// hooks/useSavedPosts.query.client.ts
// Purpose: infinite (load-more) query over getSavedPosts, injecting the Clerk
//   token; keyset cursor advances via the response's nextCursor. The debounced
//   search term is part of the query key so a new term starts a fresh paginated
//   stream (no stale-page bleed between queries).
// Constraints: only runs once Clerk is loaded and signed in.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import {
    getSavedPosts,
    type TSavedPostsResponse,
} from '@/apis/getSavedPosts.api';

const PAGE_LIMIT = 20;

export const savedPostsQueryKey = (query: string) =>
    ['savedPosts', query] as const;

export function useSavedPosts(query: string) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useInfiniteQuery<
        TSavedPostsResponse,
        Error,
        InfiniteData<TSavedPostsResponse>,
        ReturnType<typeof savedPostsQueryKey>,
        string | undefined
    >({
        queryKey: savedPostsQueryKey(query),
        initialPageParam: undefined,
        queryFn: async ({ pageParam }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getSavedPosts(token, {
                query: query || undefined,
                cursor: pageParam,
                limit: PAGE_LIMIT,
            });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: isLoaded && isSignedIn === true,
    });
}
