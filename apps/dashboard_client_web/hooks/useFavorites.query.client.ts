// hooks/useFavorites.query.client.ts
// Purpose: TanStack Query wrapper over getFavorites, injecting the Clerk bearer
//   token and exposing membership as a Set<string> for O(1) per-card lookups.
// Constraints: only runs once Clerk is loaded and the user is signed in (an
//   anonymous user has no favorites to fetch). Post ids stay STRINGS.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getFavorites } from '@/apis/getFavorites.api';

export const favoritesQueryKey = ['favorites'] as const;

export function useFavorites() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useQuery<Set<string>>({
        queryKey: favoritesQueryKey,
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const { postIds } = await getFavorites(token);
            return new Set(postIds);
        },
        enabled: isLoaded && isSignedIn === true,
    });
}
