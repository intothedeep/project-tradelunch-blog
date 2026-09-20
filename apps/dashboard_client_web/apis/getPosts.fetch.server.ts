import 'server-only';

// apis/getPosts.fetch.server.ts
// Purpose: server-side blog feed fetcher. All requests go no-store (via the
// shared serverRequest wrapper) — Cloudflare is the sole edge cache, so there
// is no per-caller caching distinction between owner and anonymous views.
// Constraints: server-only. Token is resolved at the TOP, outside any cached
// scope, then passed down explicitly (null = anonymous).

import { auth } from '@clerk/nextjs/server';
import { buildFeedQuery } from '@/apis/buildFeedQuery';
import type { TPostFilters } from '@/apis/getPosts.api';
import type { TPost, TPaginatedResponse } from '@/apis/blog.types';
import { serverRequest } from '@/apis/http.server';

// The Express feed read endpoints wrap their payload in a `{ success, data }`
// envelope: `res.json({ success: true, data: { posts, nextCursor, hasMore } })`.
// The legacy axios path unwrapped it TWICE (response-interceptor → HTTP body,
// then an explicit `.data`); native fetch does neither, so we unwrap here.
// Defaulting `posts` to [] guarantees the server feed component can never read
// `.length` of undefined (the prod RSC 500 this fixes: digest 650637976).
type TFeedEnvelope = {
    success?: boolean;
    data?: {
        posts?: TPost[];
        nextCursor?: string | null;
        hasMore?: boolean;
    };
};

function unwrapFeed(env: TFeedEnvelope | null | undefined): TPaginatedResponse {
    const data = env?.data;
    return {
        success: env?.success ?? false,
        posts: data?.posts ?? [],
        nextCursor: data?.nextCursor ?? null,
        hasMore: data?.hasMore ?? false,
    };
}

export async function getFeed(
    cursor: string | undefined,
    limit: number,
    username: string,
    filters?: TPostFilters
): Promise<TPaginatedResponse> {
    // The public feed MUST NOT 500 if auth resolution fails. A resolved token
    // gives Express owner context (drafts visible); null = anonymous view.
    // Never let Clerk hiccups take down the anonymous homepage.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    const { path } = buildFeedQuery({
        cursor,
        limit,
        username,
        categories: filters?.categories,
        tags: filters?.tags,
    });

    const env = await serverRequest<TFeedEnvelope>({
        path,
        token,
        fallbackError: `Failed to fetch posts: ${username}`,
    });
    return unwrapFeed(env);
}
