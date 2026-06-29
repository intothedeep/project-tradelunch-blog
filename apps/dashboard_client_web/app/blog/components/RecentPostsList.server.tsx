import { loadMorePosts } from '@/app/actions/post.action';
import { RecentPostsListClient } from '@/app/blog/components/RecentPostsList.client';
import { CDN_ASSETS } from '@/env.schema';

// ============================================================================
// RecentPostsList Component
// ============================================================================
interface RecentPostsListProps {
    // Author username (already stripped of any leading '@'). Required.
    username: string;
    // Optional category-title filter (per-author). When set, only posts in a
    // category with this exact title are listed.
    categoryTitle?: string;
    cdnBaseUrl?: string;
}

export const RecentPostsList: React.FC<RecentPostsListProps> = async ({
    username,
    categoryTitle,
}) => {
    const { posts, nextCursor, hasMore } = await loadMorePosts(
        undefined,
        10,
        username,
        categoryTitle
    );

    if (posts.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm font-mono">
                    <span className="animate-pulse">▋</span> No articles found
                </p>
            </div>
        );
    }

    return (
        <RecentPostsListClient
            username={username}
            categoryTitle={categoryTitle}
            initialPosts={posts}
            initialCursor={nextCursor}
            initialHasMore={hasMore}
            cdnURL={CDN_ASSETS}
        />
    );
};
