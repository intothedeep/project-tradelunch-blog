// apis/getPostsByTag.api.ts
// Purpose: read one page of the global by-tag feed.
// Server-only fetcher — called exclusively from Server Components.
// Express GET /v1/api/posts/by-tag/:tag returns { success, data: page }.
// cursor is an opaque numeric STRING (Snowflake precision): passed through
// verbatim, never Number()'d, and only sent when defined (omit for page 1).
// Vestigial Cache-Control/Expires request headers removed — they were no-ops
// on the request side (only response headers affect caching).
import { TPost } from '@/apis/blog.types';
import { serverRequest } from '@/apis/http.server';

type TByTagPage = {
    posts: TPost[];
    nextCursor: string | null;
    hasMore: boolean;
};

interface TEnvelope {
    success: boolean;
    data: TByTagPage;
}

export async function getPostsByTag(
    tag: string,
    cursor?: string,
    limit: number = 20
): Promise<TByTagPage> {
    try {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        params.append('limit', String(limit));
        const qs = params.toString();
        const path = `/v1/api/posts/by-tag/${encodeURIComponent(tag)}${qs ? `?${qs}` : ''}`;

        const envelope = await serverRequest<TEnvelope>({
            path,
            fallbackError: `Failed to fetch posts by tag: ${tag}`,
        });
        const { posts, nextCursor, hasMore } = envelope.data;
        return { posts, nextCursor, hasMore };
    } catch (error) {
        console.error('Failed to fetch posts by tag:', error);
        throw new Error(`Failed to fetch posts by tag: ${tag}`);
    }
}
