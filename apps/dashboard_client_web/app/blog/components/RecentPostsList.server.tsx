import { getTranslations } from 'next-intl/server';

import { getFeed } from '@/apis/getPosts.fetch.server';
import { RecentPostsListClient } from '@/app/blog/components/RecentPostsList.client';
import { CDN_ASSETS } from '@/env.schema';
import { serializeFacet } from '@/utils/filter-state';

// ============================================================================
// RecentPostsList Component
// ============================================================================
interface RecentPostsListProps {
    // Author username (already stripped of any leading '@'). Required.
    username: string;
    // Multi-facet feed filter (per-author): categories OR (ancestor-inclusive),
    // tags OR, cross-attribute AND — resolved server-side.
    filters: { categories: string[]; tags: string[] };
    cdnBaseUrl?: string;
}

export const RecentPostsList: React.FC<RecentPostsListProps> = async ({
    username,
    filters,
}) => {
    const t = await getTranslations('blog.filters');
    const { categories, tags } = filters;

    // An unreachable API must not take the whole page to the error boundary:
    // the layout, nav and sidebar still render, only this list degrades.
    let feed: Awaited<ReturnType<typeof getFeed>>;
    try {
        feed = await getFeed(undefined, 10, username, { categories, tags });
    } catch (err) {
        console.error(
            '[RecentPostsList] feed fetch failed:',
            err instanceof Error ? err.message : err
        );
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm font-mono">
                    <span className="animate-pulse">▋</span> Posts are
                    unavailable right now. Please try again in a moment.
                </p>
            </div>
        );
    }
    const { posts, nextCursor, hasMore } = feed;

    if (posts.length === 0) {
        const isFiltered = categories.length > 0 || tags.length > 0;
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm font-mono">
                    <span className="animate-pulse">▋</span>{' '}
                    {isFiltered ? t('noPostsFor') : 'No articles found'}
                </p>
            </div>
        );
    }

    return (
        <RecentPostsListClient
            // Remount on any filter change so pagination resets (no stale rows).
            key={`${serializeFacet(categories)}|${serializeFacet(tags)}`}
            username={username}
            categories={categories}
            tags={tags}
            initialPosts={posts}
            initialCursor={nextCursor}
            initialHasMore={hasMore}
            cdnURL={CDN_ASSETS}
        />
    );
};
