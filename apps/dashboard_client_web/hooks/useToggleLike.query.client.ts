// hooks/useToggleLike.query.client.ts
// Purpose: TanStack Query mutation that toggles a post like. A like is a PUBLIC
//   approval signal, so the SERVER decides the resulting state and returns the
//   live like count (TLikeToggleResponse). This hook owns the viewer's LIKED
//   set: it optimistically flips the post's membership in the shared
//   ['viewer-likes'] cache (onMutate), rolls back on error, and re-syncs from
//   the server on settle — so every LikeButton for the post (feed card + detail)
//   reflects the toggle and the liked state survives a refresh. The calling
//   button owns only the optimistic COUNT display (public aggregate), seeded
//   from the server-supplied initial prop.
// Constraints: requires a Clerk token; the post id is a STRING (Snowflake
//   precision) — never Number()/parseInt.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleLike } from '@/apis/toggleLike.api';
import { viewerLikesQueryKey } from '@/hooks/useViewerLikes.query.client';
import type { TLikeToggleResponse } from '@repo/types';

type TToggleInput = { postId: string };
type TContext = { previous: Set<string> | undefined };

export function useToggleLike() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<TLikeToggleResponse, Error, TToggleInput, TContext>({
        mutationFn: async ({ postId }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return toggleLike(token, postId);
        },
        onMutate: async ({ postId }) => {
            await queryClient.cancelQueries({ queryKey: viewerLikesQueryKey });
            const previous =
                queryClient.getQueryData<Set<string>>(viewerLikesQueryKey);
            const next = new Set(previous ?? []);
            if (next.has(postId)) next.delete(postId);
            else next.add(postId);
            queryClient.setQueryData(viewerLikesQueryKey, next);
            return { previous };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData(viewerLikesQueryKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: viewerLikesQueryKey });
        },
    });
}
