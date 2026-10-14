import { ProjectPostGate } from '@/components/projects/ProjectPostGate.server';
import { HomeRightRail } from '@/components/rail/HomeRightRail.server';
import { RightRailToc } from '@/components/rail/RightRailToc.client';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { RailContextPublisher } from '@/components/rail/RailContextPublisher.client';

// Post-detail right rail: a post inside a project shares its parent's rail (the
// project page's HomeRightRail, #118) with the post TOC on top, and no Recently
// viewed (#79); every other post gets the author rails. The publisher is the leaf
// signal that hides Recently viewed, because the URL cannot tell a project post.
// Callers wrap it in <Suspense>.
export const RightRailSwitch = ({
    username,
    slug,
}: {
    username: string;
    slug: string;
}) => (
    <ProjectPostGate
        username={username}
        slug={slug}
        whenProject={
            <>
                <RailContextPublisher hideRecent />
                <div className="flex flex-col gap-4">
                    <RightRailToc />
                    <HomeRightRail username={username} />
                </div>
            </>
        }
    >
        <UserContextRail username={username} />
    </ProjectPostGate>
);

export default RightRailSwitch;
