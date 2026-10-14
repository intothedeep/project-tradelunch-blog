import { ProjectPostGate } from '@/components/projects/ProjectPostGate.server';
import { ProjectsRail } from '@/components/projects/ProjectsRail.server';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { RailContextPublisher } from '@/components/rail/RailContextPublisher.client';

// Post-detail right rail: a post inside a project gets the projects rail (TOC
// above the tree, no Recently viewed, #79); every other post gets the author
// rails. The publisher is the leaf signal that hides Recently viewed, because
// the URL cannot tell a project post. Callers wrap it in <Suspense>.
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
                <ProjectsRail username={username} />
            </>
        }
    >
        <UserContextRail username={username} />
    </ProjectPostGate>
);

export default RightRailSwitch;
