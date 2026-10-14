// Purpose: SERVER composition site for the left rail. Reads no cookie (collapse
// state is client-side, see store/layout.atom) and passes the async server
// TagCloud — wrapped in Suspense with a chip skeleton — DOWN into the client
// LeftRail as a child (a server component cannot be imported inside a client
// component, but it can be passed as a prop from a server parent).
// Side effects: none.

import { Suspense } from 'react';
import { LeftRail } from '@/components/rail/LeftRail.client';
import { TagCloud } from '@/components/rail/TagCloud.server';
import { ProjectsBadgeSlot } from '@/components/rail/ProjectsCountBadge.server';
import { TagCloudSkeleton } from '@/components/rail/TagCloud.skeleton';

export const LeftRailContainer = () => (
    <LeftRail
        navBadges={{ projects: <ProjectsBadgeSlot /> }}
        tagCloud={
            <Suspense fallback={<TagCloudSkeleton />}>
                <TagCloud />
            </Suspense>
        }
    />
);

export default LeftRailContainer;
