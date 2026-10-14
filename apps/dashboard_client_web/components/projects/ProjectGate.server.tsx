import { getProjectPosts } from '@/apis/getProjectPosts.api';

// 404 gate for an unknown project, as a Suspense leaf (cacheComponents).
// getProjectPosts throws notFound() for a missing project; it is cache()-
// memoized, so the page's identical call costs no second request. Status
// stays 200 once the shell is out (see UserGate).
export async function ProjectGate({
    username,
    project,
}: {
    username: string;
    project: string;
}) {
    await getProjectPosts(username, project);
    return null;
}
