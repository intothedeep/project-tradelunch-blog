// hooks/useMyDrafts.query.client.ts
// Purpose: TanStack Query wrapper over getMyDrafts, injecting the Clerk token.
// Constraints: only runs once Clerk is loaded and signed in (and `enabled`).

'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getMyDrafts } from '@/apis/getMyDrafts.api';
import type { TDraftSummary } from '@repo/types';

export const myDraftsQueryKey = ['users', 'me', 'drafts'] as const;

export function useMyDrafts(enabled = true) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    return useQuery<TDraftSummary[]>({
        queryKey: myDraftsQueryKey,
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getMyDrafts(token);
        },
        enabled: enabled && isLoaded && isSignedIn === true,
    });
}
