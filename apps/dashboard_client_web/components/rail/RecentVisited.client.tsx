'use client';

// Purpose: left-rail "Recently viewed" section (H5.4) — a compact list of the
// viewer's recently-viewed posts from useRecents, each linking to its post.
// Identical on `/` and `/blog/[username]` (the LeftRail is shared). Graceful
// empty state. Rendered only in the EXPANDED rail (LeftRail gates visibility).
// Side effects: none beyond reading useRecents (localStorage).

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRecents } from '@/hooks/useRecents.hook';
import { RailSection } from '@/components/rail/RailSection.client';

export const RecentVisited = () => {
    const { recents } = useRecents();
    const t = useTranslations('blog');

    return (
        <RailSection title={t('rail.recentlyViewed')}>
            {recents.length ? (
                <ul className="flex flex-col gap-1">
                    {recents.slice(0, 8).map((post) => {
                        const href =
                            post.username && post.slug
                                ? `/blog/@${post.username}/${post.slug}`
                                : null;
                        return (
                            <li key={post.id}>
                                {href ? (
                                    <Link
                                        href={href}
                                        title={post.title}
                                        className="block truncate rounded px-1 py-1 text-sm text-foreground transition-colors hover:bg-accent/50"
                                    >
                                        {post.title}
                                    </Link>
                                ) : (
                                    <span
                                        title={post.title}
                                        className="block truncate px-1 py-1 text-sm text-muted-foreground"
                                    >
                                        {post.title}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                    {t('rail.recentlyViewedEmpty')}
                </p>
            )}
        </RailSection>
    );
};

export default RecentVisited;
