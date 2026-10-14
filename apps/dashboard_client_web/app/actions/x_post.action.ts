// app/actions/posts.action.ts
'use server';

import { getBlogPostsByUsername, TPostFilters } from '@/apis/getPosts.api';

export async function loadMorePosts(
    cursor: string | undefined,
    limit: number,
    username: string,
    filters?: TPostFilters
) {
    const data = await getBlogPostsByUsername(cursor, limit, username, filters);
    return data;
}
