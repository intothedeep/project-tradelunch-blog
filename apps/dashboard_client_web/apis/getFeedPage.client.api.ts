// apis/getFeedPage.client.api.ts
// Purpose: browser-side load-more (page 2+) straight from the Express feed GETs
// on blog-api., replacing the retired Next BFF /api/posts/load-more (CC U7, Q11 b).
// Constraints: cursor stays a STRING end-to-end. The `{ success, data }` envelope
// is unwrapped exactly once here. Per-author feed takes the Clerk token (owner
// sees drafts on page 2+, same rule as page 1); the by-tag feed is anonymous,
// same as its page 1.

import { buildFeedQuery } from '@/apis/buildFeedQuery';
import type { TPaginatedResponse, TPost } from '@/apis/blog.types';
import { clientRequest } from '@/apis/http.client';

type TFeedEnvelope = {
    success?: boolean;
    data?: {
        posts?: TPost[];
        nextCursor?: string | null;
        hasMore?: boolean;
    };
};

function unwrapFeed(env: TFeedEnvelope | undefined): TPaginatedResponse {
    const data = env?.data;
    if (!data || !Array.isArray(data.posts)) {
        throw new Error('Malformed load-more response');
    }
    return {
        success: env?.success ?? false,
        posts: data.posts,
        nextCursor: data.nextCursor ?? null,
        hasMore: data.hasMore ?? false,
    };
}

export async function getFeedPageClient(params: {
    cursor: string;
    limit: number;
    username: string;
    categories: string[];
    tags: string[];
    token: string | null;
}): Promise<TPaginatedResponse> {
    const { token, ...feed } = params;
    const { path } = buildFeedQuery(feed);
    const env = await clientRequest<TFeedEnvelope>({
        path,
        token,
        fallbackError: 'Failed to load more posts',
    });
    return unwrapFeed(env);
}

export async function getTagPageClient(params: {
    tag: string;
    cursor: string;
    limit: number;
}): Promise<TPaginatedResponse> {
    const qs = new URLSearchParams({
        cursor: params.cursor,
        limit: String(params.limit),
    });
    const env = await clientRequest<TFeedEnvelope>({
        path: `/v1/api/posts/by-tag/${encodeURIComponent(params.tag)}?${qs}`,
        fallbackError: 'Failed to load more tag posts',
    });
    return unwrapFeed(env);
}
