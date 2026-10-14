// apis/getCategories.api.ts
// Purpose: fetch the authenticated (or anonymous) user's category tree.
// Isomorphic — safe from both Server Components and client hooks.
// Constraints: Express returns { success, data: { categories } } envelope.

import { cache } from 'react';
import { clientRequest } from '@/apis/http.client';
import { TTreeNodeWithChildren } from '@repo/types';

// cache() dedupes per server request by value (fetch dedupe is off, see
// http.core); on the client it is a plain passthrough. The token stays an
// argument so an owner call never shares a result with an anonymous one.
const fetchCategories = cache(
    async (
        username: string,
        token: string | null
    ): Promise<{ categories: TTreeNodeWithChildren[] }> => {
        const env = await clientRequest<{
            success: boolean;
            data: { categories: TTreeNodeWithChildren[] };
        }>({
            path: `/v1/api/posts/users/${username}/categories`,
            token,
            fallbackError: 'Failed to fetch categories',
        });
        return env.data;
    }
);

// `undefined` and `null` both mean anonymous; normalize so they share a key.
export function getCategoriesByUsername(
    username: string,
    token?: string | null
): Promise<{ categories: TTreeNodeWithChildren[] }> {
    return fetchCategories(username, token ?? null);
}
