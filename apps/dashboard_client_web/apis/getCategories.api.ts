// apis/getCategories.api.ts
// Purpose: fetch the authenticated (or anonymous) user's category tree.
// Isomorphic — safe from both Server Components and client hooks.
// Constraints: Express returns { success, data: { categories } } envelope.

import { clientRequest } from '@/apis/http.client';
import { TTreeNodeWithChildren } from '@repo/types';

export async function getCategoriesByUsername(
    username: string,
    token?: string | null
): Promise<{ categories: TTreeNodeWithChildren[] }> {
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
