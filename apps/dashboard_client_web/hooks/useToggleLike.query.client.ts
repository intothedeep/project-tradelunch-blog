// hooks/useToggleLike.query.client.ts
// Purpose: TanStack Query mutation that toggles a post like. A like is a PUBLIC
//   approval signal, so the SERVER decides the resulting state and returns the
//   live like count (TLikeToggleResponse); the calling button owns the
//   optimistic display (seed → flip → reconcile on the server result, roll back
//   on error).
// Constraints: requires a Clerk token; the post id is a STRING (Snowflake
//   precision) — never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { toggleLike } from '@/apis/toggleLike.api';
import type { TLikeToggleResponse } from '@repo/types';

type TToggleInput = { postId: string };

export function useToggleLike() {
    const { getToken } = useAuth();

    return useMutation<TLikeToggleResponse, Error, TToggleInput>({
        mutationFn: async ({ postId }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return toggleLike(token, postId);
        },
    });
}
