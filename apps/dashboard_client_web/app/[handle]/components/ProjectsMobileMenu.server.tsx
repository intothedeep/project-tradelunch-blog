import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { MobileCategory } from '@/components/blog/MobileCategory.client';
import { CategoryErrorBoundary } from '@/components/blog/CategoryErrorboundary.client';
import { TreeRowsSkeleton } from '@/components/rail/RailSkeleton';
import { ProjectsTreeWrapper } from '@/app/[handle]/components/ProjectsTreeWrapper.server';

// < lg: the projects tree as a collapsed accordion above the main column (the
// right rail that holds it on >= lg is hidden there). Same tree, bare chrome.
export const ProjectsMobileMenu = async ({
    username,
}: {
    username: string;
}) => {
    const t = await getTranslations('blog.projects');

    return (
        <div className="lg:hidden">
            <MobileCategory title={t('treeTitle')}>
                <CategoryErrorBoundary>
                    <Suspense fallback={<TreeRowsSkeleton />}>
                        <ProjectsTreeWrapper
                            username={username}
                            bare
                        />
                    </Suspense>
                </CategoryErrorBoundary>
            </MobileCategory>
        </div>
    );
};

export default ProjectsMobileMenu;
