// hooks/useClaimUsername.query.client.ts
// Purpose: TanStack Query mutation wrapper over postUsername, injecting the
// Clerk bearer token. Invalidates the cached `me` profile on success.
// Constraints: rejects with UsernameClaimError on 400/409 for inline handling.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postUsername, type TUsernameClaim } from '@/apis/postUsername.api';
import { meQueryKey } from '@/hooks/useMe.query.client';

export function useClaimUsername() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<TUsernameClaim, Error, string>({
        mutationFn: async (username: string) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return postUsername(token, username);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meQueryKey });
        },
    });
}
