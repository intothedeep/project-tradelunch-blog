// apis/getPostsByTag.api.ts
// Purpose: read one page of the global by-tag feed.
// Invariants: the response interceptor on axios_instance already strips axios's
//   own wrapper and resolves to the JSON BODY ({ success, data: page }); reading
//   `response.data` here therefore yields `json.data` — the page object — exactly
//   as getPosts.api does for the plain feed. cursor is an opaque numeric STRING
//   (Snowflake precision): passed through verbatim, never Number()'d, and only
//   sent when defined (omit for page 1).
import { TPost } from '@/apis/blog.types';
import axios_instance from '@/apis/axios_instance';

type TByTagPage = {
    posts: TPost[];
    nextCursor: string | null;
    hasMore: boolean;
};

export async function getPostsByTag(
    tag: string,
    cursor?: string,
    limit: number = 20
): Promise<TByTagPage> {
    try {
        const response = await axios_instance.get<TByTagPage>(
            `/v1/api/posts/by-tag/${encodeURIComponent(tag)}`,
            {
                params: { ...(cursor ? { cursor } : {}), limit },
                headers: {
                    'Cache-Control': 'public, max-age=3600',
                    Expires: new Date(Date.now() + 3600 * 1000).toUTCString(),
                },
            }
        );

        // Interceptor already returned json body; `.data` = json.data = page.
        const { posts, nextCursor, hasMore } = response.data;
        return { posts, nextCursor, hasMore };
    } catch (error) {
        console.error('Failed to fetch posts by tag:', error);
        throw new Error(`Failed to fetch posts by tag: ${tag}`);
    }
}
