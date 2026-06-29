'use client';

// Purpose: a horizontal scroll-snap row of FilterChips for one facet (mobile,
// <lg). Content-clipped (no negative margin) so chips clip at the content edge;
// a right edge-fade gradient cues more content. Keyboard-reachable (tabIndex=0).
// Invariants: pure presentational shell — all active/toggle logic lives in
// FilterChip (which reads the URL). Renders nothing when there are no items.
// Side effects: none (data passed in by the caller).

import { cn } from '@/lib/utils';
import { FilterChip } from '@/components/blog/filter/FilterChip.client';
import type { TFilterState } from '@/utils/filter-state';

type TFacetKey = keyof TFilterState;

type TFilterItem = {
    label: string;
    value: string;
    count?: number;
};

type Props = {
    username: string;
    facet: TFacetKey;
    items: TFilterItem[];
    ariaLabel: string;
};

export const FilterChipRow: React.FC<Props> = ({
    username,
    facet,
    items,
    ariaLabel,
}) => {
    if (!items.length) return null;

    return (
        <div className="relative">
            <div
                tabIndex={0}
                aria-label={ariaLabel}
                className={cn(
                    'flex gap-2 overflow-x-auto snap-x snap-proximity',
                    '[&::-webkit-scrollbar]:hidden'
                )}
            >
                {items.map((item) => (
                    <FilterChip
                        key={`${facet}:${item.value}`}
                        username={username}
                        facet={facet}
                        value={item.value}
                        label={item.label}
                        count={item.count}
                    />
                ))}
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background" />
        </div>
    );
};

export default FilterChipRow;
