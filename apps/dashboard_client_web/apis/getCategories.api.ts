// apis/getCategories.api.ts
// import { TTreeNode } from '@/apis/blog.types';

import axios_instance from '@/apis/axios_instance';
import {
    ETreeNodeType,
    TCategoryTreeResponse,
} from '@repo/markdown-parsing/types';

export type TCategory = {
    id: number;
    title: string;
    slug: string;
    parent_id: number;
    root_id: number;
    level: number;
    post_count: number;
    type: ETreeNodeType;
};

// export async function getCategoriesByUsername(
//     username: string
// ): Promise<TCategoriesResponse> {
//     try {
//         const response = await axios_instance.get<TCategoriesResponse>(
//             `/v1/api/posts/users/${username}/categories`
//         );

//         console.log(
//             '>> api categories: ',
//             { status: response.status },
//             { data: response.data }
//         );

//         if (!response.success) {
//             throw new Error(`HTTP ${response.status}`);
//         }

//         return await response.data;
//     } catch (error) {
//         console.error('Failed to fetch categories:', error);
//         throw error; // Re-throw original error
//     }
// }

export async function getCategoriesByUsername(
    username: string
): Promise<TCategoryTreeResponse> {
    try {
        const response = await axios_instance.get<TCategoryTreeResponse>(
            `/v1/api/posts/users/${username}/categories`
        );

        // console.log('>> getCategoriesByUsername: ', {
        //     status: response.status,
        //     data: response.data,
        // });

        // 올바르게 success 체크
        if (!response.success) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.data;
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
    }
}
