'use client';

// Purpose: left-rail "Recently viewed" section (H5.4) — a compact list of the
// viewer's recently-viewed posts from useRecents, each linking to its post.
// Identical on `/` and `/blog/[username]` (the LeftRail is shared). Graceful
// empty state. Rendered only in the EXPANDED rail (LeftRail gates visibility).
// Side effects: none beyond reading useRecents (localStorage).

import { HoverPrefetchLink } from '@/components/ui/HoverPrefetchLink.client';
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
                                    // Hover-only prefetch: up to 8 recents on every page would add 8
                                    // prefetches per navigation (decision #70).
                                    <HoverPrefetchLink
                                        href={href}
                                        title={post.title}
                                        className="block truncate rounded px-1 py-1 text-sm text-foreground transition-colors hover:bg-accent/50"
                                    >
                                        {post.title}
                                    </HoverPrefetchLink>
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
