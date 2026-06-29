'use client';

// Purpose: GLOBAL right-rail widget for `/` — lists the viewer's recently-viewed
// posts (H5.3) from useRecents, each linking to its post and showing the comment
// + like counts captured at view time (stale-but-fine display snapshot).
// Empty-recents fallback (P1.1): when there are no recents, render the GLOBAL
// popular tags passed in as `popularTagsFallback` (a server <TagCloud/>) — the
// right column is NEVER empty.
// Side effects: none beyond reading useRecents (localStorage).

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart, MessageSquare } from 'lucide-react';
import { useRecents } from '@/hooks/useRecents.hook';
import { RailSection } from '@/components/rail/RailSection.client';

export const RecentPostsWidget = ({
    popularTagsFallback,
}: {
    popularTagsFallback?: React.ReactNode;
}) => {
    const { recents } = useRecents();
    const t = useTranslations('blog');

    if (!recents.length) {
        return (
            <RailSection title={t('rail.popularTags')}>
                {popularTagsFallback}
            </RailSection>
        );
    }

    return (
        <RailSection title={t('rail.recentlyViewed')}>
            <ul className="flex flex-col gap-1">
                {recents.map((post) => {
                    const href =
                        post.username && post.slug
                            ? `/blog/@${post.username}/${post.slug}`
                            : null;

                    const body = (
                        <>
                            <span className="line-clamp-2 text-sm text-foreground">
                                {post.title}
                            </span>
                            <span className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {post.commentCount ?? 0}
                                </span>
                                <span aria-hidden>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <Heart className="h-3 w-3" />
                                    {post.likeCount ?? 0}
                                </span>
                            </span>
                        </>
                    );

                    return (
                        <li key={post.id}>
                            {href ? (
                                <Link
                                    href={href}
                                    className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
                                >
                                    {body}
                                </Link>
                            ) : (
                                <span className="block px-2 py-1.5">
                                    {body}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </RailSection>
    );
};

export default RecentPostsWidget;
