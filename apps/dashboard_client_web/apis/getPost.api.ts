import { cache } from 'react';
import axios_instance from '@/apis/axios_instance';

// getPostBySlug is React-cache()-memoized so multiple RSC calls in the same
// request share one network round-trip. The token is part of the cache key so
// an anonymous call and an authenticated call never share the same entry —
// preventing a private-bearing response from being served to a different viewer.
export const getPostBySlug = cache(
    async ({ slug, token }: { slug: string; token?: string | null }) => {
        try {
            const config = token
                ? { headers: { Authorization: `Bearer ${token}` } }
                : undefined;
            const response = await axios_instance.get(
                `/v1/api/posts/slug/${slug}`,
                config
            );
            return response.data;
        } catch (error) {
            console.error('Failed to fetch posts:', error);
            throw new Error(`Failed to fetch a post: ${slug}`);
        }
    }
);
