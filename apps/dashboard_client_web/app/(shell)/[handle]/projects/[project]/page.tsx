import type { Metadata } from 'next';
import { FolderOpen } from 'lucide-react';
import { getProjectPosts } from '@/apis/getProjectPosts.api';
import { ProjectPostList } from '@/components/projects/ProjectPostList.client';
import { ProjectsMobileMenu } from '@/components/projects/ProjectsMobileMenu.server';
import { stripUsernameAt } from '@/utils/blog-author';
import { projectPath } from '@/utils/routes';

type Props = { params: Promise<{ handle: string; project: string }> };

// Route params arrive percent-encoded; the project name is the raw category title.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { handle, project } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    const name = decodeURIComponent(project);

    return {
        title: name,
        alternates: { canonical: projectPath(username, name) },
    };
}

export default async function ProjectPage({ params }: Props) {
    const { handle, project } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    const { project: ref, posts } = await getProjectPosts(
        username,
        decodeURIComponent(project)
    );

    return (
        <section className="flex flex-col gap-4">
            <ProjectsMobileMenu username={username} />
            <header className="border border-primary bg-tone-projects p-4">
                <h1 className="flex items-center gap-2 font-mono text-xl font-bold text-primary">
                    <FolderOpen className="h-5 w-5 shrink-0" />{' '}
                    {ref.project.toUpperCase()}
                </h1>
            </header>
            <ProjectPostList
                username={username}
                posts={posts}
            />
        </section>
    );
}
