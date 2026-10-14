import { auth } from '@clerk/nextjs/server';
import { getProjectsTree } from '@/apis/getProjectsTree.api';
import { ProjectsTree } from '@/app/[handle]/components/ProjectsTree.client';

type Props = { username: string; bare?: boolean; hideWhenEmpty?: boolean };

// The only place on the projects screens that reads auth(), so the owner sees
// own private posts in the tree. Mounted inside Suspense by its callers, which
// keeps the page and layout above it free of dynamic reads.
export const ProjectsTreeWrapper = async ({
    username,
    bare = false,
    hideWhenEmpty = false,
}: Props) => {
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    const { nodes } = await getProjectsTree(username, token);

    if (hideWhenEmpty && nodes.length === 0) return null;

    return (
        <ProjectsTree
            username={username}
            nodes={nodes}
            bare={bare}
        />
    );
};

export default ProjectsTreeWrapper;
