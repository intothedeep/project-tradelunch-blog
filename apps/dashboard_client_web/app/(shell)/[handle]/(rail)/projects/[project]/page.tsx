import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FolderOpen } from 'lucide-react';
import { getProjectPosts } from '@/apis/getProjectPosts.api';
import { ProjectPostList } from '@/components/projects/ProjectPostList.client';
import { ProjectsMobileMenu } from '@/components/projects/ProjectsMobileMenu.server';
import { stripUsernameAt } from '@/utils/blog-author';
import { groupAnchorPath } from '@/utils/project-groups';
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
    const t = await getTranslations('blog.projects');
    const groupLabel =
        ref.group === null
            ? null
            : t.has(`groups.${ref.group}.short`)
              ? t(`groups.${ref.group}.short`)
              : ref.group.toUpperCase();

    return (
        <section className="flex flex-col gap-4">
            <ProjectsMobileMenu username={username} />
            <header className="border border-primary bg-tone-projects p-4">
                {ref.group !== null ? (
                    <p className="mb-1 font-mono text-xs text-muted-foreground">
                        <Link
                            href={groupAnchorPath(username, ref.group)}
                            prefetch={false}
                            className="hover:underline"
                        >
                            {groupLabel}
                        </Link>{' '}
                        ▸ {ref.project}
                    </p>
                ) : null}
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
