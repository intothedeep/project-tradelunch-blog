// hooks/useMe.query.client.ts
// Purpose: TanStack Query wrapper over getMe, injecting the Clerk bearer token.
// Constraints: only runs once Clerk is loaded and the user is signed in.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getMe, type TMe } from '@/apis/getMe.api';

export const meQueryKey = ['users', 'me'] as const;

export function useMe() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useQuery<TMe>({
        queryKey: meQueryKey,
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getMe(token);
        },
        enabled: isLoaded && isSignedIn === true,
    });
}
