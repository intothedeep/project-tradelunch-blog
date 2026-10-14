import { Suspense } from 'react';
import { RightRailToc } from '@/components/rail/RightRailToc.client';
import { CategoryErrorBoundary } from '@/app/blog/components/CategoryErrorboundary.client';
import { ProjectsTreeWrapper } from '@/app/[handle]/components/ProjectsTreeWrapper.server';

// Right rail of the projects screens: the post TOC (empty, so nothing, on list
// pages) above the projects tree. No Recently viewed, no profile card, no tag
// cloud (#79). Callers wrap it in <RightRail>.
export const ProjectsRail = ({ username }: { username: string }) => {
    return (
        <div className="flex flex-col gap-4">
            <RightRailToc />
            <CategoryErrorBoundary>
                <Suspense fallback={null}>
                    <ProjectsTreeWrapper username={username} />
                </Suspense>
            </CategoryErrorBoundary>
        </div>
    );
};

export default ProjectsRail;
