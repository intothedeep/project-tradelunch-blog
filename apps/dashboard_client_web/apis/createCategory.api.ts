// apis/createCategory.api.ts
// Purpose: create (or resurrect) a category for the authenticated user. parentId
// null/absent = a root node. On a 409 active-duplicate the server returns the
// EXISTING node as `data` — we resolve it as success so the caller selects it.
// Constraints: requires a Clerk bearer token; other non-2xx surfaces as ApiError.
// Category ids stay STRINGS (BIGINT-safe) — never Number() them.

import { clientRequest } from '@/apis/http.client';
import { ApiError } from '@/utils/apiError.util';
import type { TCategoryNode, TCreateCategoryInput } from '@repo/types';

interface TEnvelope {
    success: boolean;
    message?: string;
    data: TCategoryNode;
}

export async function createCategory(
    token: string,
    input: TCreateCategoryInput
): Promise<TCategoryNode> {
    try {
        const envelope = await clientRequest<TEnvelope>({
            path: '/v1/api/categories',
            method: 'POST',
            body: input,
            token,
            fallbackError: 'Failed to create category',
        });
        return envelope.data;
    } catch (error) {
        // 409 conflict: the server returns the existing node in the error body;
        // resolve it as success so the caller selects the pre-existing category.
        if (error instanceof ApiError && error.status === 409) {
            const existing = (error.body as TEnvelope | undefined)?.data;
            if (existing) return existing;
        }
        throw error;
    }
}
