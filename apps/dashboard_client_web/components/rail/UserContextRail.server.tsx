// Purpose: composes the per-user right-rail content (H5.5): author profile card
// + that author's category tree (REUSES CategorySidebarWrapper, guarded by the
// existing CategoryErrorBoundary) + the author's scoped popular tags (TagCloud
// with `username`; chips link to the GLOBAL /tags/<tag> route). This same content
// is reused for BOTH the >=lg right rail and the <lg UserContextSheet.
// Side effects: network reads delegated to its async children (each isolates its
// own failure).

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { UserProfileCard } from '@/components/rail/UserProfileCard.server';
import { TagCloud } from '@/components/rail/TagCloud.server';
import { TagCloudSkeleton } from '@/components/rail/TagCloud.skeleton';
import { RailSection } from '@/components/rail/RailSection.client';
import { CategorySidebarWrapper } from '@/app/blog/components/CategorySidebarWrapper.server';
import { CategoryErrorBoundary } from '@/app/blog/components/CategoryErrorboundary.client';

export const UserContextRail = async ({ username }: { username: string }) => {
    const t = await getTranslations('blog');

    return (
        <div className="flex flex-col gap-4">
            <UserProfileCard username={username} />

            <RailSection title={t('nav.category')}>
                <CategoryErrorBoundary>
                    <Suspense fallback={null}>
                        <CategorySidebarWrapper username={username} />
                    </Suspense>
                </CategoryErrorBoundary>
            </RailSection>

            <RailSection title={t('rail.popularTags')}>
                <Suspense fallback={<TagCloudSkeleton />}>
                    <TagCloud username={username} />
                </Suspense>
            </RailSection>
        </div>
    );
};

export default UserContextRail;
