'use client';

/**
 * Purpose: clear the shared React Query cache on Clerk identity change to
 *   prevent cross-user data leak (per-user keys are identity-blind).
 * Invariant: only clears on a real identity transition AFTER first load;
 *   the initial known state seeds the ref without clearing.
 * Why: a single root QueryClient persists across SPA sign-out (no reload),
 *   so an in-session account switch would otherwise serve the prior user's cache.
 */

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export function QueryAuthReset() {
    const { isLoaded, userId } = useAuth();
    const queryClient = useQueryClient();
    const prevUserId = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (!isLoaded) return;
        if (prevUserId.current === undefined) {
            prevUserId.current = userId;
            return;
        }
        if (prevUserId.current !== userId) {
            queryClient.clear();
            prevUserId.current = userId;
        }
    }, [isLoaded, userId, queryClient]);

    return null;
}
