'use client';

// Purpose: a single feed-filter chip rendered as zero-JS navigation. Reads the
// current URL facet state itself (useSearchParams), so it works identically in
// the layout-mounted desktop rails AND the page-mounted mobile rows — no
// searchParams threading. Toggling pushes the next canonical feed href.
// Invariants: active state is derived from the URL only (no local state);
// active = the lowercased value is present in this facet. Active styling reuses
// the existing active-category chip theme (border-primary + text-primary) plus
// a leading ✓ as a non-color cue. These are LINKS → aria-current, never
// aria-pressed. ≥44px tap target (min-h-11).
// Side effects: none (URL navigation is delegated to next/link).

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
    buildToggleHref,
    parseFilterState,
    type TFilterState,
} from '@/utils/filter-state';

type TFacetKey = keyof TFilterState;

type Props = {
    username: string;
    facet: TFacetKey;
    value: string;
    label: string;
    count?: number;
    className?: string;
};

const BASE =
    'snap-start shrink-0 inline-flex items-center gap-1 min-h-11 rounded-full px-2.5 py-1 text-xs transition-colors';
const INACTIVE = 'border border-border text-foreground hover:bg-accent/50';
const ACTIVE = 'border border-primary font-semibold text-primary';

export const FilterChip: React.FC<Props> = ({
    username,
    facet,
    value,
    label,
    count,
    className,
}) => {
    const t = useTranslations('blog.filters');
    const searchParams = useSearchParams();
    const current = parseFilterState({
        categories: searchParams.get('categories') ?? undefined,
        tags: searchParams.get('tags') ?? undefined,
        category_title: searchParams.get('category_title') ?? undefined,
    });
    const isActive = current[facet].includes(value.trim().toLowerCase());
    // Accessible action name (overrides the bare label so SR users hear the
    // filter action + facet, not just the title). Reuses the existing
    // blog.filters.{add,remove}{Category,Tag} keys.
    const actionKey = isActive
        ? facet === 'categories'
            ? 'removeCategory'
            : 'removeTag'
        : facet === 'categories'
          ? 'addCategory'
          : 'addTag';
    const ariaLabel = t(actionKey, { value: label });

    return (
        <Link
            href={buildToggleHref(username, current, facet, value)}
            aria-current={isActive ? 'true' : undefined}
            aria-label={ariaLabel}
            className={cn(BASE, isActive ? ACTIVE : INACTIVE, className)}
        >
            {isActive ? <span aria-hidden="true">✓</span> : null}
            <span className="truncate">
                {facet === 'tags' ? `#${label}` : label}
            </span>
            {typeof count === 'number' ? (
                <span className="text-muted-foreground">{count}</span>
            ) : null}
        </Link>
    );
};

export default FilterChip;
