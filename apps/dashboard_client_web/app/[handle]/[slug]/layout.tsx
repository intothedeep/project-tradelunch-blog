import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { ProjectsRail } from '@/app/[handle]/components/ProjectsRail.server';
import { getProjectsTree } from '@/apis/getProjectsTree.api';
import { stripUsernameAt } from '@/utils/blog-author';

// Post-detail chrome, moved from the old `blog/[username]/layout.tsx` (the
// `[handle]` layout has no shell). A post inside a project gets the projects
// rail (TOC above the tree, no Recently viewed, #79); every other post gets the
// author rails as before. The anonymous tree read is the one sanctioned data
// read in a layout (design §7.3). If the tree cannot load, fall back to the
// author rails rather than break the post.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; slug: string }>;
};

export default async function PostDetailLayout({ children, params }: Props) {
    const { handle, slug } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    const { projectOfSlug } = await getProjectsTree(username, null).catch(
        () => ({ projectOfSlug: {} as Record<string, string> })
    );
    const isProjectPost = Boolean(projectOfSlug[decodeURIComponent(slug)]);

    return (
        <BlogShell
            leftRail={<LeftRailContainer showRecentVisited={!isProjectPost} />}
            main={children}
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
