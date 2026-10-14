import { getProjectPosts } from '@/apis/getProjectPosts.api';
import { CC_SAMPLE_PROJECT } from '@/env.schema';
import { stripUsernameAt } from '@/utils/blog-author';

// 404 gate for an unknown project. loading.tsx wraps page.tsx in Suspense, so a
// notFound() thrown in the page runs after the 200 shell has flushed (soft 404).
// A layout sits above that boundary. getProjectPosts is cache()-memoized, so the
// page's identical call costs no second request.
// cacheComponents (CC-U4): sample project for the shell prerender
// (env.schema). The `handle` sample comes from the parent layout.
export function generateStaticParams() {
    return [{ project: CC_SAMPLE_PROJECT }];
}

type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; project: string }>;
};

export default async function ProjectLayout({ children, params }: Props) {
    const { handle, project } = await params;
    await getProjectPosts(
        stripUsernameAt(decodeURIComponent(handle)),
        decodeURIComponent(project)
    );
    return <>{children}</>;
}
