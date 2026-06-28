// apis/createCategory.api.ts
// Purpose: create (or resurrect) a category for the authenticated user. parentId
// null/absent = a root node. On a 409 active-duplicate the server returns the
// EXISTING node as `data` — we resolve it as success so the caller selects it.
// Constraints: requires a Clerk bearer token; other non-2xx surfaces as ApiError.
// Category ids stay STRINGS (BIGINT-safe) — never Number() them.

import axios from 'axios';
import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
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
        const envelope = await axios_instance.post<unknown, TEnvelope>(
            '/v1/api/categories',
            input,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return envelope.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
            const existing = (error.response.data as TEnvelope | undefined)
                ?.data;
            if (existing) return existing;
        }
        throw toApiError(error, 'Failed to create category');
    }
}
