import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Rocket } from 'lucide-react';
import { getProjects } from '@/apis/getProjects.api';
import { ProjectCardGrid } from '@/components/projects/ProjectCardGrid.server';
import { ProjectsMobileMenu } from '@/components/projects/ProjectsMobileMenu.server';
import { stripUsernameAt } from '@/utils/blog-author';
import { groupProjectCards } from '@/utils/project-groups';
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
    const sections = groupProjectCards(projects).map((section) => ({
        ...section,
        anchor: section.group ?? 'ungrouped',
        label:
            section.group === null
                ? t('ungrouped')
                : t.has(`groups.${section.group}.short`)
                  ? t(`groups.${section.group}.short`)
                  : section.group.toUpperCase(),
    }));

    return (
        <section className="flex flex-col gap-4">
            <ProjectsMobileMenu username={username} />
            <header className="border border-primary bg-tone-projects p-4">
                <h1 className="flex items-center gap-2 font-mono text-xl font-bold text-primary">
                    <Rocket className="h-5 w-5 shrink-0" />{' '}
                    {t('title').toUpperCase()}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t('subtitle', { username })}
                </p>
            </header>
            {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
                <>
                    {sections.length >= 2 ? (
                        <nav className="flex flex-wrap gap-2 lg:hidden">
                            {sections.map((section) => (
                                <Link
                                    key={section.anchor}
                                    href={`#${section.anchor}`}
                                    prefetch={false}
                                    className="border border-primary px-2 py-1 font-mono text-xs"
                                >
                                    {section.label}
                                </Link>
                            ))}
                        </nav>
                    ) : null}
                    {sections.map((section) => (
                        <section
                            key={section.anchor}
                            id={section.anchor}
                            className="flex flex-col gap-3"
                        >
                            <h2 className="font-mono text-base font-bold text-primary">
                                {section.label} ({section.projects.length})
                            </h2>
                            <ProjectCardGrid
                                username={username}
                                projects={section.projects}
                            />
                        </section>
                    ))}
                </>
            )}
        </section>
    );
}
