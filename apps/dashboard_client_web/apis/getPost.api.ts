import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ApiError } from '@/utils/apiError.util';
import { serverRequest } from '@/apis/http.server';
import type { TPost } from '@/apis/blog.types';

// getPostBySlug is React-cache()-memoized so multiple RSC calls in the same
// request share one network round-trip. cache() keys by argument IDENTITY, not
// value — an object-literal arg (`{ slug, token }`) is a fresh reference on
// every call and always misses, silently defeating the memoization. Positional
// primitive args key by value instead, so identical calls actually dedupe.
// The token is part of the cache key so an anonymous call and an authenticated
// call never share the same entry — preventing a private-bearing response from
// being served to a different viewer. cache() keys on the RAW arguments, so
// (slug, undefined) and (slug, null) are DIFFERENT entries — every detail-render
// caller must pass `token` the same way (they all pass getToken()'s string|null).
// Express GET /v1/api/posts/slug/:slug returns { success, data: post }.
export const getPostBySlug = cache(
    async (
        slug: string,
        token?: string | null,
        /** OG image route only — see the note in apis/http.server.ts. */
        revalidate?: number
    ) => {
        const normalizedToken = token ?? null;
        try {
            const envelope = await serverRequest<{
                success: boolean;
                data: TPost;
            }>({
                path: `/v1/api/posts/slug/${slug}`,
                token: normalizedToken,
                revalidate,
                fallbackError: `Failed to fetch a post: ${slug}`,
            });
            return envelope.data;
        } catch (error) {
            // A missing slug is a 404, not a crash: relative image refs in post
            // bodies (`![](x.png)`) resolve to /blog/@user/x.png and land here.
            if (error instanceof ApiError && error.status === 404) notFound();
            console.error('Failed to fetch posts:', error);
            throw new Error(`Failed to fetch a post: ${slug}`);
        }
    }
);
