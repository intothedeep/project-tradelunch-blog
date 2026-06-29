// app/actions/posts.action.ts
'use server';

import { getBlogPostsByUsername } from '@/apis/getPosts.api';

export async function loadMorePosts(
    cursor: string | undefined,
    limit: number,
    username: string,
    categoryTitle?: string
) {
    const data = await getBlogPostsByUsername(
        cursor,
        limit,
        username,
        categoryTitle
    );
    return data;
}
