// apis/getCategories.api.ts

import axios_instance from '@/apis/axios_instance';
import {
    TCategoryTreeResponse,
    TTreeNodeWithChildren,
} from '@repo/types';

// export type TCategory = {
//     id: number;
//     title: string;
//     slug: string;
//     parent_id: number;
//     root_id: number;
//     level: number;
//     post_count: number;
//     type: ETreeNodeType;
// };

export async function getCategoriesByUsername(
    username: string
): Promise<{ categories: TTreeNodeWithChildren[] }> {
    try {
        const response = await axios_instance.get<
            any,
            TCategoryTreeResponse,
            { username: string }
        >(`/v1/api/posts/users/${username}/categories`);

        console.log('>> getCategoriesByUsername: ', { response });

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
