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
import type { TPaginatedResponse } from '@/apis/blog.types';
import { serverRequest } from '@/apis/http.server';

const FEED_REVALIDATE_SECONDS = 60;

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
        return serverRequest<TPaginatedResponse>({
            path,
            token,
            cache: 'no-store',
            fallbackError,
        });
    }

    // Anonymous: viewer-agnostic, tag-cached for revalidation on publish.
    // NOTE: opt into caching via `next.revalidate` ALONE — do NOT also pass
    // `cache:'force-cache'`; Next rejects the two together ("only one should be
    // used"), which would throw during the server render.
    const tags = ['feed:global', `feed:${username || 'global'}`];
    return serverRequest<TPaginatedResponse>({
        path,
        tags,
        revalidate: FEED_REVALIDATE_SECONDS,
        fallbackError,
    });
}
