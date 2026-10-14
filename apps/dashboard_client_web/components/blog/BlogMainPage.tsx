import { Suspense } from 'react';

import { FeedListSkeleton } from '@/components/blog/FeedListSkeleton';
import { RecentPostsList } from '@/components/blog/RecentPostsList.server';

// ============================================================================
// BlogMainPage Component
// ============================================================================

interface Props {
    username: string;
    // Per-author multi-facet filter. Omitted on the global/home feeds (no
    // per-author categories) → defaults to no filtering.
    filters?: { categories: string[]; tags: string[] };
}

const NO_FILTERS = { categories: [], tags: [] };

export const BlogMainPage: React.FC<Props> = async ({
    username,
    filters = NO_FILTERS,
}) => {
    return (
        <section className="relative w-full">
            <Suspense fallback={<FeedListSkeleton />}>
                <RecentPostsList
                    username={username}
                    filters={filters}
                />
            </Suspense>
        </section>
    );
};

export default BlogMainPage;
