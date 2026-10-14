import { auth } from '@clerk/nextjs/server';
import { getPostBySlug } from '@/apis/getPost.api';
import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { RailContextPublisher } from '@/components/rail/RailContextPublisher.client';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { ProjectsRail } from '@/components/projects/ProjectsRail.server';
import { getProjectsTree } from '@/apis/getProjectsTree.api';
import { stripUsernameAt } from '@/utils/blog-author';

// Post-detail chrome, moved from the old `blog/[username]/layout.tsx` (the
// `[handle]` layout has no shell). A post inside a project gets the projects
// rail (TOC above the tree, no Recently viewed, #79); every other post gets the
// author rails as before. The anonymous tree read is the one sanctioned data
// read in a layout (design §7.3). If the tree cannot load, fall back to the
// author rails rather than break the post.
//
// The post read is also the 404 gate: loading.tsx wraps page.tsx in Suspense, so
// a notFound() thrown in the page or its leaves runs after the 200 shell has
// flushed (soft 404). A layout sits above that boundary, so notFound() here
// still sets the HTTP status. It reads with the viewer token (same cache key as
// PostContentCard) so the owner's private post is not 404'd.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; slug: string }>;
};

export default async function PostDetailLayout({ children, params }: Props) {
    const { handle, slug } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }
    await getPostBySlug(slug, token);

    const { projectOfSlug } = await getProjectsTree(username, null).catch(
        () => ({ projectOfSlug: {} as Record<string, string> })
    );
    const isProjectPost = Boolean(projectOfSlug[decodeURIComponent(slug)]);

    return (
        <ContentFrame
            main={
                <>
                    {/* Leaf signal: the URL cannot tell a project post (#79). */}
                    <RailContextPublisher hideRecent={isProjectPost} />
                    {children}
                </>
            }
            rightRail={
                <RightRail>
                    {isProjectPost ? (
                        <ProjectsRail username={username} />
                    ) : (
                        <UserContextRail username={username} />
                    )}
                </RightRail>
            }
            mobileTopContext={
                isProjectPost ? undefined : (
                    <MobileContextHeader username={username} />
                )
            }
        />
    );
}
