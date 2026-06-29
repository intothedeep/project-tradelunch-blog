// Purpose: popular-tags cloud for the rails. Async SERVER component. With no
// `username` it fetches the GLOBAL getPopularTags(30); with a `username` it
// fetches that author's scoped tags (getUserPopularTags) — H5.5. Either way each
// tag renders as a Link to the GLOBAL /tags/<tag> route (F5) with a subtle count.
// Failure is caught and degraded to an inline rail-level "tags unavailable" line
// (never rethrows — must not break the shell). Empty renders a "no tags" state.
// Side effects: one network read (isolated to this boundary).

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getPopularTags } from '@/apis/getPopularTags.api';
import { getUserPopularTags } from '@/apis/getUserPopularTags.api';
import type { TPopularTag } from '@repo/types';

const FALLBACK_LINE = 'px-1 py-2 text-xs text-muted-foreground';

export const TagCloud = async ({ username }: { username?: string } = {}) => {
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

    return (
        <ul className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
                <li key={tag}>
                    <Link
                        href={`/tags/${encodeURIComponent(tag)}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent/50"
                    >
                        <span className="truncate">{tag}</span>
                        <span className="text-muted-foreground">{count}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
};

export default TagCloud;
