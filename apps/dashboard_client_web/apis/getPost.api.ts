import { cache } from 'react';
import { serverRequest } from '@/apis/http.server';
import type { TPost } from '@/apis/blog.types';

// getPostBySlug is React-cache()-memoized so multiple RSC calls in the same
// request share one network round-trip. The token is part of the cache key so
// an anonymous call and an authenticated call never share the same entry —
// preventing a private-bearing response from being served to a different viewer.
// Express GET /v1/api/posts/slug/:slug returns { success, data: post }.
export const getPostBySlug = cache(
    async ({ slug, token }: { slug: string; token?: string | null }) => {
        try {
            const envelope = await serverRequest<{
                success: boolean;
                data: TPost;
            }>({
                path: `/v1/api/posts/slug/${slug}`,
                token,
                fallbackError: `Failed to fetch a post: ${slug}`,
            });
            return envelope.data;
        } catch (error) {
            console.error('Failed to fetch posts:', error);
            throw new Error(`Failed to fetch a post: ${slug}`);
        }
    }
);
