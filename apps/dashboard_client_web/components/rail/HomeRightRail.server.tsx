// Purpose: right rail of `/` — three bordered, square-cornered boxes: the site
// owner's projects tree, the owner's category tree, and recently viewed (global
// popular tags when there are no recents). Each data box reads in its own
// Suspense leaf; auth() stays inside the wrappers.
// Side effects: network reads delegated to the async children.

import { Suspense } from 'react';
import { ProjectsTreeWrapper } from '@/app/[handle]/components/ProjectsTreeWrapper.server';
import { CategorySidebarWrapper } from '@/components/blog/CategorySidebarWrapper.server';
import { CategoryErrorBoundary } from '@/components/blog/CategoryErrorboundary.client';
import { RecentPostsWidget } from '@/components/rail/RecentPostsWidget.client';
import { TagCloud } from '@/components/rail/TagCloud.server';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';
import { postsPath } from '@/utils/routes';

export const HomeRightRail = () => {
    return (
        <div className="flex flex-col gap-4">
            <CategoryErrorBoundary>
                <Suspense fallback={null}>
                    <ProjectsTreeWrapper
                        username={HOME_FEED_AUTHOR}
                        hideWhenEmpty
                    />
                </Suspense>
            </CategoryErrorBoundary>
            <CategoryErrorBoundary>
                <Suspense fallback={null}>
                    <CategorySidebarWrapper
                        username={HOME_FEED_AUTHOR}
                        mode="filter"
                        filterBasePath={postsPath(HOME_FEED_AUTHOR)}
                        className="rounded-none"
                    />
                </Suspense>
            </CategoryErrorBoundary>
            <div className="rounded-none border border-primary bg-card">
                <RecentPostsWidget popularTagsFallback={<TagCloud />} />
            </div>
        </div>
    );
};

export default HomeRightRail;
