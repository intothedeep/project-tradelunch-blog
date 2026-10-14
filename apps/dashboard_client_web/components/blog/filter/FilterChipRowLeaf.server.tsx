// Purpose: async leaf that fetches the author's tag filter items and renders the
// chip row. Lives behind a <Suspense> so the feed does not wait on this read.
// Side effects: one failure-contained network read (getTagFilterItems).

import { FilterChipRow } from '@/components/blog/filter/FilterChipRow.client';
import { getTagFilterItems } from '@/components/blog/filter/getFilterItems.server';

type Props = {
    username: string;
    ariaLabel: string;
};

export const FilterChipRowLeaf = async ({ username, ariaLabel }: Props) => {
    const items = await getTagFilterItems(username);

    return (
        <FilterChipRow
            username={username}
            facet="tags"
            items={items}
            ariaLabel={ariaLabel}
        />
    );
};
