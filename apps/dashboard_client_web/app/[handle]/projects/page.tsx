import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProjects } from '@/apis/getProjects.api';
import { ProjectCardGrid } from '@/app/[handle]/components/ProjectCardGrid.server';
import { ProjectsMobileMenu } from '@/app/[handle]/components/ProjectsMobileMenu.server';
import { stripUsernameAt } from '@/utils/blog-author';
import { projectsPath } from '@/utils/routes';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    const t = await getTranslations('blog.projects');

    return {
        title: t('title'),
        description: t('subtitle', { username }),
        alternates: { canonical: projectsPath(username) },
    };
}

export default async function ProjectsPage({ params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    const t = await getTranslations('blog.projects');
    const projects = await getProjects(username);

    return (
        <section className="flex flex-col gap-4">
            <ProjectsMobileMenu username={username} />
            <header>
                <h1 className="text-xl font-bold">{t('title')}</h1>
                <p className="text-sm text-muted-foreground">
                    {t('subtitle', { username })}
                </p>
            </header>
            {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
                <ProjectCardGrid
                    username={username}
                    projects={projects}
                />
            )}
        </section>
    );
}
