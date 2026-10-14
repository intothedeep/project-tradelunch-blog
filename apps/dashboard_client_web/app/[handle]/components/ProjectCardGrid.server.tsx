import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { TProjectCard } from '@repo/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectThumbnail } from '@/app/[handle]/components/ProjectThumbnail.server';
import { projectPath } from '@/utils/routes';

type Props = { username: string; projects: TProjectCard[] };

// One card per project: thumbnail and title come from the overview post (the
// project's first post by priority, seq). A project with no visible post has a
// null overview and shows an empty thumbnail and no title.
export const ProjectCardGrid = async ({ username, projects }: Props) => {
    const t = await getTranslations('blog.projects');

    return (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((card) => (
                <li key={card.project_id}>
                    <Link
                        href={projectPath(username, card.project)}
                        prefetch={false}
                        className="block h-full"
                    >
                        <Card className="h-full overflow-hidden rounded-none border-primary bg-card transition-colors hover:bg-secondary">
                            <ProjectThumbnail
                                storedUri={card.overview?.stored_uri ?? null}
                                alt={card.overview?.title ?? card.project}
                                className="aspect-video w-full"
                            />
                            <CardContent className="flex flex-col gap-1 p-3 sm:p-4">
                                <h2 className="text-base font-bold">
                                    {card.project}
                                </h2>
                                {card.overview ? (
                                    <p className="text-xs text-muted-foreground">
                                        {t('overview')}: {card.overview.title}
                                    </p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">
                                    {t('postCount', {
                                        count: card.post_count,
                                    })}
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </li>
            ))}
        </ul>
    );
};

export default ProjectCardGrid;
