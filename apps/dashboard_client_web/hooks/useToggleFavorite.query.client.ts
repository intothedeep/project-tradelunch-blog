// hooks/useToggleFavorite.query.client.ts
// Purpose: TanStack Query mutation that toggles a post favorite with an
//   OPTIMISTIC cache update (onMutate flips the Set immediately, onError rolls
//   back to the snapshot, onSettled re-syncs from the server).
// Constraints: requires a Clerk token; the favorites cache is keyed by post.id
//   (STRING). Caller passes the CURRENT favorited state so the hook picks
//   add vs remove without re-reading the cache.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFavorite } from '@/apis/addFavorite.api';
import { removeFavorite } from '@/apis/removeFavorite.api';
import { favoritesQueryKey } from '@/hooks/useFavorites.query.client';

type TToggleInput = { postId: string; isFavorited: boolean };
type TContext = { previous: Set<string> | undefined };

export function useToggleFavorite() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, TToggleInput, TContext>({
        mutationFn: async ({ postId, isFavorited }) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            if (isFavorited) {
                await removeFavorite(token, postId);
            } else {
                await addFavorite(token, postId);
            }
        },
        onMutate: async ({ postId, isFavorited }) => {
            await queryClient.cancelQueries({ queryKey: favoritesQueryKey });
            const previous =
                queryClient.getQueryData<Set<string>>(favoritesQueryKey);
            const next = new Set(previous ?? []);
            if (isFavorited) next.delete(postId);
            else next.add(postId);
            queryClient.setQueryData(favoritesQueryKey, next);
            return { previous };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData(favoritesQueryKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
        },
    });
}
