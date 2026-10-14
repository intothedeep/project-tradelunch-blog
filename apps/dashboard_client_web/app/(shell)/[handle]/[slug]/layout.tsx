import { Suspense } from 'react';
import { preloadProjectsTree } from '@/apis/getProjectsTree.api';
import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RailCardSkeleton } from '@/components/rail/RailSkeleton';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { PostGate } from '@/components/projects/PostGate.server';
import { ProjectPostGate } from '@/components/projects/ProjectPostGate.server';
import { RightRailSwitch } from '@/components/projects/RightRailSwitch.server';
import { CC_SAMPLE_SLUG } from '@/env.schema';
import { stripUsernameAt } from '@/utils/blog-author';

// cacheComponents (CC-U4): sample slug for the shell prerender (env.schema).
// The `handle` sample comes from the parent layout.
export function generateStaticParams() {
    return [{ slug: CC_SAMPLE_SLUG }];
}

// Post-detail chrome, moved from the old `blog/[username]/layout.tsx` (the
// `[handle]` layout has no shell). The layout is the shell only: which rail a
// post gets (project rail vs author rails, #79) is decided by the tree read
// inside the Suspense leaves RightRailSwitch and ProjectPostGate.
//
// The post read is also the 404 gate, as the Suspense leaf PostGate: under
// cacheComponents a layout cannot await uncached data above every Suspense
// boundary. The view becomes the 404 page, the HTTP status stays 200. PostGate
// reads with the viewer token (same cache key as PostContentCard) so the
// owner's private post is not 404'd, and preloads the first comment page.
// The anonymous tree preload (`void`, never awaited) runs beside it.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; slug: string }>;
};

export default async function PostDetailLayout({ children, params }: Props) {
    const { handle, slug } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    preloadProjectsTree(username);

    return (
        <ContentFrame
            main={
                <>
                    <Suspense fallback={null}>
                        <PostGate slug={slug} />
                    </Suspense>
                    {/* < lg author chip for non-project posts only (#74, #79).
                        Rendered here, not via mobileTopContext, because that
                        slot's wrapper would leave an empty gap for project
                        posts. */}
                    <Suspense fallback={null}>
                        <ProjectPostGate
                            username={username}
                            slug={slug}
                        >
                            <div className="mb-3 lg:hidden">
                                <Suspense
                                    fallback={<RailCardSkeleton rows={1} />}
                                >
                                    <MobileContextHeader username={username} />
                                </Suspense>
                            </div>
                        </ProjectPostGate>
                    </Suspense>
                    {children}
                </>
            }
            rightRail={
                <RightRail>
                    <Suspense fallback={<RailCardSkeleton />}>
                        <RightRailSwitch
                            username={username}
                            slug={slug}
                        />
                    </Suspense>
                </RightRail>
            }
        />
    );
}
