import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { HomeRightRail } from '@/components/rail/HomeRightRail.server';
import { stripUsernameAt } from '@/utils/blog-author';

// Chrome of /@u/projects and /@u/projects/<project>: global left rail without
// Recently viewed (#79), main column, right rail = projects tree, categories (filter into /@u/posts) and
// Recently viewed, like home (owner, 2026-10-14). No
// mobileTopContext: on < lg the page puts the projects accordion in main.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function ProjectsLayout({ children, params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    return (
        <ContentFrame
            main={children}
            rightRail={
                <RightRail>
                    <HomeRightRail username={username} />
                </RightRail>
            }
        />
    );
}
