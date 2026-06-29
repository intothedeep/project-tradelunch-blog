// apis/getPosts.api.ts
import { TPaginatedResponse } from '@/apis/blog.types';
import axios_instance from '@/apis/axios_instance';

export async function getBlogPostsByUsername(
    cursor: string | number = 0,
    limit: number = 10,
    username: string = '',
    // Optional category-title filter — only meaningful for the per-author feed
    // (categories are per-author); ignored for the all-authors global feed.
    categoryTitle?: string
): Promise<TPaginatedResponse> {
    try {
        const url = username
            ? `/v1/api/posts/users/${username}`
            : `/v1/api/posts`;

        const response = await axios_instance.get<TPaginatedResponse>(url, {
            params: {
                ...(cursor ? { cursor } : {}),
                limit,
                ...(username && categoryTitle
                    ? { category_title: categoryTitle }
                    : {}),
            },
            headers: {
                // 'Cache-Control':
                //     'no-store, no-cache, must-revalidate, proxy-revalidate',
                // Pragma: 'no-cache',
                // Expires: '0',
                'Cache-Control': 'public, max-age=3600',
                Expires: new Date(Date.now() + 3600 * 1000).toUTCString(),
            },
        });

        // console.log(response);

        return response.data;
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw new Error(`Failed to fetch posts: ${username}`);
    }
}

// export async function getBlogPosts(
//     cursor: number = 0,
//     limit: number = 10
// ): Promise<TPaginatedResponse> {
//     try {
//         const response = await axios_instance.get<TPaginatedResponse>(
//             `/v1/api/posts`,
//             {
//                 params: { cursor, limit },
//             }
//         );

//         return response.data;
//     } catch (error) {
//         console.error('Failed to fetch posts:', error);
//         throw new Error('Failed to fetch posts');
//     }
// }
