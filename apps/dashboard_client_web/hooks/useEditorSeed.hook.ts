// hooks/useEditorSeed.hook.ts
// Purpose: produce the initial editor state for a route. For a new post it is
// empty defaults; for an existing post BOTH metadata and the real body are
// seeded from the owner-scoped by-id endpoint (token-authenticated), which
// returns a draft/private post including its `content`, `tags`, and thumbnail.
// Constraints: client-only. The body is hydrated from getPostById with a Clerk
// bearer token (never the anonymous public slug route, which 404s on a private
// draft and used to silently empty the editor). If the post cannot be loaded
// (genuine 404 / not owner) `initial` stays null so the editor never seeds — and
// therefore never lets autosave clobber the stored draft with empty content.

'use client';

import { useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getPostById } from '@/apis/getPostById.api';
import type { TPost } from '@/apis/blog.types';
import type { TPostInput, TPostStatus } from '@repo/types';

export const postByIdQueryKey = (postId: string | null) =>
    ['post', 'id', postId] as const;

const EMPTY_INPUT: TPostInput = {
    title: '',
    content: '',
    description: '',
    status: 'draft',
    categoryId: null,
    tags: [],
};

export interface EditorSeed {
    initial: TPostInput | null;
    // Stored thumbnail public URL for an existing post (the files.is_thumbnail
    // row, surfaced as post.stored_uri by the read API). Null for a new post or
    // a post without a thumbnail.
    thumbnailUrl: string | null;
    isLoading: boolean;
}

// Map an owner's snake_case post row into the camelCase editor input shape.
// category_id is a STRING (BIGINT-safe) and is passed through untouched — never
// Number() it. tags are the lowercase canonical set (empty when absent).
const toEditorInput = (post: TPost): TPostInput => ({
    title: post.title ?? '',
    content: post.content ?? '',
    description: post.description ?? '',
    status: (post.status as TPostStatus | undefined) ?? 'draft',
    categoryId: post.category_id ?? null,
    tags: post.tags ?? [],
    slug: post.slug,
});

export function useEditorSeed(postId: string | null): EditorSeed {
    const isEdit = postId != null;
    const { getToken } = useAuth();

    const { data: post, isLoading } = useQuery<TPost>({
        queryKey: postByIdQueryKey(postId),
        queryFn: async () => {
            if (postId == null) throw new Error('Missing post id');
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return getPostById(token, postId);
        },
        enabled: isEdit,
    });

    const initial = useMemo<TPostInput | null>(() => {
        if (!isEdit) return EMPTY_INPUT;
        if (!post) return null;
        return toEditorInput(post);
    }, [isEdit, post]);

    const thumbnailUrl = isEdit ? (post?.stored_uri ?? null) : null;

    return {
        initial,
        thumbnailUrl,
        isLoading: isEdit ? isLoading : false,
    };
}
