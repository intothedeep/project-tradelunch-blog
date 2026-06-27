// hooks/useViewerLikes.query.client.ts
// Purpose: TanStack Query wrapper over getLikedPosts, injecting the Clerk bearer
//   token and exposing the viewer's liked posts as a Set<string> for O(1)
//   per-card lookups. This is what makes a like SURVIVE a refresh: the SSR post
//   read is cacheable/anonymous (viewerLiked is always false there), so each
//   LikeButton seeds its liked state from this client query instead.
// Constraints: only runs once Clerk is loaded and the user is signed in (an
//   anonymous viewer has no likes to fetch). Post ids stay STRINGS.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getLikedPosts } from '@/apis/getLikedPosts.api';

export const viewerLikesQueryKey = ['viewer-likes'] as const;

export function useViewerLikes() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useQuery<Set<string>>({
        queryKey: viewerLikesQueryKey,
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const { postIds } = await getLikedPosts(token);
            return new Set(postIds);
        },
        enabled: isLoaded && isSignedIn === true,
    });
}
