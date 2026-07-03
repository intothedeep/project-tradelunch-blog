// Purpose: popular-tags cloud for the rails. Async SERVER component. With no
// `username` it fetches the GLOBAL getPopularTags(30); with a `username` it
// fetches that author's scoped tags (getUserPopularTags) — H5.5. In the default
// 'nav' mode each tag links to the GLOBAL /tags/<tag> route. In 'filter' mode
// (desktop author rail, Phase 2-filter) each tag renders as a FilterChip that
// toggles the per-author tag facet (active state derived from the URL).
// Failure is caught and degraded to an inline rail-level "tags unavailable" line
// (never rethrows — must not break the shell). Empty renders a "no tags" state.
// Side effects: one network read (isolated to this boundary).

import { getTranslations } from 'next-intl/server';
import { getPopularTags } from '@/apis/getPopularTags.api';
import { getUserPopularTags } from '@/apis/getUserPopularTags.api';
import { FilterChip } from '@/components/blog/filter/FilterChip.client';
import { NavTagLink } from '@/components/rail/NavTagLink.client';
import type { TPopularTag } from '@repo/types';

const FALLBACK_LINE = 'px-1 py-2 text-xs text-muted-foreground';

type Props = {
    username?: string;
    // 'filter' = toggle the per-author tag facet (requires username).
    mode?: 'nav' | 'filter';
};

export const TagCloud = async ({ username, mode = 'nav' }: Props = {}) => {
    const t = await getTranslations('blog');

    let tags: TPopularTag[];
    try {
        tags = username
            ? await getUserPopularTags(username, 30)
            : await getPopularTags(30);
    } catch {
        return <p className={FALLBACK_LINE}>{t('rail.tagsUnavailable')}</p>;
    }

    if (!tags.length) {
        return <p className={FALLBACK_LINE}>{t('rail.noTags')}</p>;
    }

    const isFilter = mode === 'filter' && Boolean(username);

    return (
        <ul className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
                <li key={tag}>
                    {isFilter ? (
                        <FilterChip
                            username={username!}
                            facet="tags"
                            value={tag}
                            label={tag}
                            count={count}
                        />
                    ) : (
                        <NavTagLink
                            tag={tag}
                            count={count}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
};

export default TagCloud;
