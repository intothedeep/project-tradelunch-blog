// hooks/useAdminPosts.query.client.ts
// Purpose: infinite (load-more) query over getAdminPosts, injecting the Clerk
// token; keyset cursor advances via the response's nextCursor.
// Constraints: only runs once Clerk is loaded and signed in.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { getAdminPosts } from '@/apis/getAdminPosts.api';
import type { TAdminPostListResponse } from '@repo/types';

export const adminPostsQueryKey = ['adminPosts'] as const;

const PAGE_LIMIT = 20;

export function useAdminPosts(enabled = true) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useInfiniteQuery<
        TAdminPostListResponse,
        Error,
        InfiniteData<TAdminPostListResponse>,
        typeof adminPostsQueryKey,
        string | number | undefined
    >({
        queryKey: adminPostsQueryKey,
        initialPageParam: undefined,
        queryFn: async ({ pageParam }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getAdminPosts(token, {
                cursor: pageParam,
                limit: PAGE_LIMIT,
            });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: enabled && isLoaded && isSignedIn === true,
    });
}
