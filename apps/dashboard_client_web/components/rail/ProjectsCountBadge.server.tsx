// Purpose: square count badge for the Projects menu item (rail, mobile drawer,
// mobile dropdown). Async SERVER component: one token-free read of the home
// author's project cards, isolated behind Suspense (cacheComponents: no uncached
// fetch outside a boundary). Zero projects or a failed read renders nothing.
// Side effects: one network read (isolated to this boundary).

import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { getProjects } from '@/apis/getProjects.api';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';

const ProjectsCountBadge = async () => {
    let count: number;
    try {
        count = HOME_FEED_AUTHOR
            ? (await getProjects(HOME_FEED_AUTHOR)).length
            : 0;
    } catch (error) {
        unstable_rethrow(error);
        return null;
    }
    if (count === 0) return null;

    return (
        <span className="inline-flex min-w-5 items-center justify-center rounded-none border border-primary bg-primary px-1 text-xs leading-4 text-primary-foreground">
            {count}
        </span>
    );
};

// Pass this down as `navBadges.projects`; the fallback is empty so the row
// never shifts a skeleton in.
export const ProjectsBadgeSlot = () => (
    <Suspense fallback={null}>
        <ProjectsCountBadge />
    </Suspense>
);
