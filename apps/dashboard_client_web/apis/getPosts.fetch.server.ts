import 'server-only';

// apis/getPosts.fetch.server.ts
// Purpose: server-side blog feed fetcher built on the native-fetch wrapper, so
// the anonymous feed is tag-cached (revalidatable) while the owner's view stays
// uncached (drafts must never enter a shared cache).
// Invariant: a resolved Clerk token ⇒ owner context ⇒ no-store; anonymous ⇒
// force-cache with feed tags + 60s revalidate.
// Constraints: server-only. Token is resolved at the TOP, outside any cached
// scope, then passed down explicitly.

import { auth } from '@clerk/nextjs/server';
import { buildFeedQuery } from '@/apis/buildFeedQuery';
import type { TPostFilters } from '@/apis/getPosts.api';
import type { TPost, TPaginatedResponse } from '@/apis/blog.types';
import { serverRequest } from '@/apis/http.server';

const FEED_REVALIDATE_SECONDS = 60;

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
    // ⇒ owner context (no-store); no token OR any auth failure ⇒ anonymous
    // (cached). Never let Clerk hiccups take down the anonymous homepage.
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

    const fallbackError = `Failed to fetch posts: ${username}`;

    if (token) {
        // Owner context: response may include the owner's drafts/private posts,
        // so it is per-viewer and MUST NOT be shared-cached.
        const env = await serverRequest<TFeedEnvelope>({
            path,
            token,
            cache: 'no-store',
            fallbackError,
        });
        return unwrapFeed(env);
    }

    // Anonymous: viewer-agnostic, tag-cached for revalidation on publish.
    // NOTE: opt into caching via `next.revalidate` ALONE — do NOT also pass
    // `cache:'force-cache'`; Next rejects the two together ("only one should be
    // used"), which would throw during the server render.
    const tags = ['feed:global', `feed:${username || 'global'}`];
    const env = await serverRequest<TFeedEnvelope>({
        path,
        tags,
        revalidate: FEED_REVALIDATE_SECONDS,
        fallbackError,
    });
    return unwrapFeed(env);
}
