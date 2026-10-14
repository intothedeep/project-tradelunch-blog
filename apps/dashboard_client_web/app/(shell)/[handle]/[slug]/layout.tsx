import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { getPostBySlug } from '@/apis/getPost.api';
import { preloadCommentsFirstPage } from '@/apis/getCommentsFirstPage.api';
import { preloadProjectsTree } from '@/apis/getProjectsTree.api';
import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RailCardSkeleton } from '@/components/rail/RailSkeleton';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { ProjectPostGate } from '@/components/projects/ProjectPostGate.server';
import { RightRailSwitch } from '@/components/projects/RightRailSwitch.server';
import { stripUsernameAt } from '@/utils/blog-author';

// Post-detail chrome, moved from the old `blog/[username]/layout.tsx` (the
// `[handle]` layout has no shell). The layout is the shell only: which rail a
// post gets (project rail vs author rails, #79) is decided by the tree read
// inside the Suspense leaves RightRailSwitch and ProjectPostGate.
//
// The post read is also the 404 gate: loading.tsx wraps page.tsx in Suspense, so
// a notFound() thrown in the page or its leaves runs after the 200 shell has
// flushed (soft 404). A layout sits above that boundary, so notFound() here
// still sets the HTTP status. It reads with the viewer token (same cache key as
// PostContentCard) so the owner's private post is not 404'd.
//
// Preloads (`void`, never awaited) start the reads the leaves need next: the
// anonymous tree runs beside the post read, the first comment page right after
// it. cache() hands the in-flight promises to the leaves.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; slug: string }>;
};

export default async function PostDetailLayout({ children, params }: Props) {
    const { handle, slug } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    preloadProjectsTree(username);

    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }
    const post = await getPostBySlug(slug, token);
    preloadCommentsFirstPage(post.id);

    return (
        <ContentFrame
            main={
                <>
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
