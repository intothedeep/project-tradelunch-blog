'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TProjectPost } from '@repo/types';
import { ProjectThumbnail } from '@/app/[handle]/components/ProjectThumbnail.server';
import { HoverPrefetchLink } from '@/components/ui/HoverPrefetchLink.client';
import { cn } from '@/lib/utils';
import { formatPostDate } from '@/utils/formatPostDate';
import { postPath } from '@/utils/routes';

type Props = { username: string; posts: TProjectPost[] };

// Posts arrive in ascending order (priority ASC, seq ASC, #73). The number is the
// post's ascending position, so "1." stays the overview when the list is reversed.
export const ProjectPostList = ({ username, posts }: Props) => {
    const t = useTranslations('blog.projects');
    const [isDescending, setIsDescending] = useState(false);
    const items = posts.map((post, index) => ({ post, order: index + 1 }));
    if (isDescending) items.reverse();

    const toggleClass = (isActive: boolean) =>
        cn(
            'px-2 py-1 transition-colors hover:text-foreground',
            isActive ? 'font-bold text-foreground' : 'text-muted-foreground'
        );

    return (
        <>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                <p className="text-muted-foreground">
                    {t('postCount', { count: posts.length })}
                </p>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        aria-pressed={!isDescending}
                        onClick={() => setIsDescending(false)}
                        className={toggleClass(!isDescending)}
                    >
                        {t('sortAscending')}
                    </button>
                    <button
                        type="button"
                        aria-pressed={isDescending}
                        onClick={() => setIsDescending(true)}
                        className={toggleClass(isDescending)}
                    >
                        {t('sortDescending')}
                    </button>
                </div>
            </div>
            <ol className="flex flex-col gap-8">
                {items.map(({ post, order }) => (
                    <li
                        key={post.id}
                        className="flex flex-col gap-3"
                    >
                        <h2 className="text-xl font-bold sm:text-2xl">
                            <HoverPrefetchLink
                                href={postPath(username, post.slug)}
                                className="hover:underline"
                            >
                                {order}. {post.title}
                            </HoverPrefetchLink>
                        </h2>
                        <HoverPrefetchLink
                            href={postPath(username, post.slug)}
                            aria-label={post.title}
                            className="flex flex-col gap-4 border border-border p-4 transition-colors hover:bg-secondary sm:flex-row"
                        >
                            <ProjectThumbnail
                                storedUri={post.stored_uri}
                                alt={post.title}
                                className="aspect-video w-full shrink-0 sm:w-48"
                            />
                            <span className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                                <span className="line-clamp-3 text-sm text-muted-foreground">
                                    {post.description}
                                </span>
                                <span className="self-end text-xs text-muted-foreground">
                                    {formatPostDate(post.created_at)}
                                </span>
                            </span>
                        </HoverPrefetchLink>
                    </li>
                ))}
            </ol>
        </>
    );
};

export default ProjectPostList;
