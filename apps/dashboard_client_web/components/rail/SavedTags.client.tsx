'use client';

// Purpose: left-rail "Saved tags" section (H5.4) — chips for the viewer's saved
// tags from useSavedTags; each links to the GLOBAL /tags/<tag> route and carries
// an unsave (×) affordance. Identical on `/` and `/blog/[username]`. Graceful
// empty state. Rendered only in the EXPANDED rail (LeftRail gates visibility).
// Side effects: unsaveTag writes localStorage (via useSavedTags).

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useSavedTags } from '@/hooks/useSavedTags.hook';
import { RailSection } from '@/components/rail/RailSection.client';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const SavedTags = () => {
    const { savedTags, unsaveTag } = useSavedTags();
    const t = useTranslations('blog');

    return (
        <RailSection title={t('rail.savedTags')}>
            {savedTags.length ? (
                <ul className="flex flex-wrap gap-2">
                    {savedTags.map((tag) => (
                        <li
                            key={tag}
                            className="inline-flex items-center"
                        >
                            <Link
                                href={`/tags/${encodeURIComponent(tag)}`}
                                className={cn(
                                    badgeVariants({ variant: 'outline' }),
                                    'rounded-r-none text-xs hover:bg-accent/50'
                                )}
                            >
                                {tag}
                            </Link>
                            <button
                                type="button"
                                onClick={() => unsaveTag(tag)}
                                aria-label={t('rail.unsaveTag', { tag })}
                                className="flex h-[1.375rem] items-center rounded-r-md border border-l-0 border-border px-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                    {t('rail.savedTagsEmpty')}
                </p>
            )}
        </RailSection>
    );
};

export default SavedTags;
