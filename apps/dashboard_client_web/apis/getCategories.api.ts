// apis/getCategories.api.ts

import axios_instance from '@/apis/axios_instance';
import { TCategoryTreeResponse, TTreeNodeWithChildren } from '@repo/types';

export async function getCategoriesByUsername(
    username: string,
    token?: string | null
): Promise<{ categories: TTreeNodeWithChildren[] }> {
    try {
        const config = token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : undefined;

        const response = await axios_instance.get<
            TCategoryTreeResponse,
            TCategoryTreeResponse,
            { username: string }
        >(`/v1/api/posts/users/${username}/categories`, config);

        // response.data is TCategoryTreeResponse, check success on data
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.data;
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
    }
}
