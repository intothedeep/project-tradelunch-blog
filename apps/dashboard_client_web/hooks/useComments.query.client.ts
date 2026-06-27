// hooks/useComments.query.client.ts
// Purpose: TanStack Query wrapper over getComments — the PUBLIC comment tree for
//   a post as a flat pre-order array (the client nests by depth). Seeded from a
//   server-fetched initialData so the RSC paints instantly; refetches reconcile
//   after create/delete mutations invalidate the key.
// Constraints: public read (no token). post/comment ids stay STRINGS.

'use client';

import { useQuery } from '@tanstack/react-query';
import { getComments } from '@/apis/getComments.api';
import type { TComment } from '@repo/types';

export const commentsQueryKey = (postId: string) =>
    ['comments', postId] as const;

export function useComments(postId: string, initialData?: TComment[]) {
    return useQuery<TComment[]>({
        queryKey: commentsQueryKey(postId),
        queryFn: async () => {
            const { comments } = await getComments(postId);
            return comments;
        },
        initialData,
    });
}
