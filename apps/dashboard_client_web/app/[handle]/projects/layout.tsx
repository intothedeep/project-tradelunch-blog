import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { ProjectsRail } from '@/app/[handle]/components/ProjectsRail.server';
import { stripUsernameAt } from '@/utils/blog-author';

// Chrome of /@u/projects and /@u/projects/<project>: global left rail without
// Recently viewed (#79), main column, right rail = projects tree only. No
// mobileTopContext: on < lg the page puts the projects accordion in main.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function ProjectsLayout({ children, params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    return (
        <BlogShell
            leftRail={<LeftRailContainer showRecentVisited={false} />}
            main={children}
            rightRail={
                <RightRail>
                    <ProjectsRail username={username} />
                </RightRail>
            }
        />
    );
}
