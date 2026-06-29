'use client';

// Purpose: applied-filter summary bar shown at the top of the feed on BOTH
// breakpoints. Reads the current URL facet state and renders a removable chip
// per selected value (both facets) + a single "Clear all" reset link. Each
// remove chip is navigation to the toggle-off href; Clear-all resets EVERYTHING.
// Invariants: derives selection from the URL only; renders nothing when no
// facet is selected. Reuses the active-chip theme style (border-primary).
// Side effects: none (navigation delegated to next/link).

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
    buildFeedHref,
    buildToggleHref,
    parseFilterState,
    type TFilterState,
} from '@/utils/filter-state';

type TFacetKey = keyof TFilterState;

const CHIP =
    'inline-flex items-center gap-1 min-h-11 rounded-full border border-primary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-accent/50';
const CLEAR =
    'inline-flex items-center min-h-11 px-2 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline';

export const AppliedFilters: React.FC<{ username: string }> = ({
    username,
}) => {
    const searchParams = useSearchParams();
    const t = useTranslations('blog.filters');

    const current = parseFilterState({
        categories: searchParams.get('categories') ?? undefined,
        tags: searchParams.get('tags') ?? undefined,
        category_title: searchParams.get('category_title') ?? undefined,
    });

    const hasSelection =
        current.categories.length > 0 || current.tags.length > 0;
    if (!hasSelection) return null;

    const renderChip = (facet: TFacetKey, value: string) => {
        const removeKey =
            facet === 'categories' ? 'removeCategory' : 'removeTag';
        const display = facet === 'tags' ? `#${value}` : value;
        return (
            <Link
                key={`${facet}:${value}`}
                href={buildToggleHref(username, current, facet, value)}
                aria-label={t(removeKey, { value })}
                className={cn(CHIP)}
            >
                <span className="truncate">{display}</span>
                <span aria-hidden="true">✕</span>
            </Link>
        );
    };

    return (
        <div
            className="mb-3 flex flex-wrap items-center gap-2"
            aria-label={t('applied')}
        >
            {current.categories.map((v) => renderChip('categories', v))}
            {current.tags.map((v) => renderChip('tags', v))}
            <Link
                href={buildFeedHref(username, { categories: [], tags: [] })}
                className={CLEAR}
            >
                {t('clearAll')}
            </Link>
        </div>
    );
};

export default AppliedFilters;
