import { isProjectPostSlug } from '@/apis/getProjectsTree.api';

type Props = {
    username: string;
    slug: string;
    /** Rendered when `slug` is a post inside a project. */
    whenProject?: React.ReactNode;
    /** Rendered for every other post. */
    children?: React.ReactNode;
};

// Suspense leaf that holds the one tree read deciding project vs author chrome
// (#79), so the layout above it stays free of that await. Callers wrap it in
// <Suspense>.
export const ProjectPostGate = async ({
    username,
    slug,
    whenProject = null,
    children = null,
}: Props) => {
    return (await isProjectPostSlug(username, slug)) ? whenProject : children;
};

export default ProjectPostGate;
