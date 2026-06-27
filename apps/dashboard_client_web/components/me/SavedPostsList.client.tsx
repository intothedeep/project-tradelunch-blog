// components/me/SavedPostsList.client.tsx
// Purpose: render the signed-in user's saved (favorited) posts with a debounced
//   search box, infinite "load more" pagination, and loading/error/empty/
//   no-results states. Reuses the public RecentPostCard.
// Constraints: client-only (gated useSavedPosts hook + local search state).
//   Un-save is leave-until-refetch: clicking a card's SaveButton toggles the
//   favorite but the card is NOT optimistically spliced out — the next refetch
//   drops it. This keeps the list logic stateless and matches the feed.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RecentPostCard } from '@/app/blog/components/RecentPostCard.client';
import { SavedSearchBox } from '@/components/me/SavedSearchBox.client';
import { useSavedPosts } from '@/hooks/useSavedPosts.query.client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue.hook';
import { cn } from '@/lib/utils';

const ctaButtonClass = cn(
    'inline-block border-2 border-primary px-4 py-2 text-sm transition-colors',
    'hover:bg-primary hover:text-primary-foreground'
);

export function SavedPostsList() {
    const t = useTranslations('write');
    const [term, setTerm] = useState('');
    const debouncedTerm = useDebouncedValue(term.trim(), 300);

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useSavedPosts(debouncedTerm);

    const posts = data?.pages.flatMap((page) => page.posts) ?? [];
    const isSearching = debouncedTerm.length > 0;

    return (
        <section
            aria-labelledby="saved-heading"
            className="mx-auto w-full max-w-3xl p-4 font-mono"
        >
            <h1
                id="saved-heading"
                className="mb-4 text-lg"
            >
                {t('saved.heading')}
            </h1>

            <SavedSearchBox
                value={term}
                onChange={setTerm}
            />

            {isLoading && (
                <ul
                    className="flex flex-col gap-4"
                    aria-busy="true"
                >
                    {[0, 1, 2].map((i) => (
                        <li
                            key={i}
                            className="h-40 animate-pulse border-2 border-primary/20 bg-primary/5"
                        />
                    ))}
                </ul>
            )}

            {!isLoading && isError && (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {t('saved.loadError')}
                </p>
            )}

            {!isLoading && !isError && posts.length === 0 && !isSearching && (
                <div className="flex flex-col items-start gap-3 border-2 border-primary/30 p-6 text-sm">
                    <span className="text-muted-foreground">
                        {t('saved.emptyTitle')}
                    </span>
                    <Link
                        href="/blog"
                        className={ctaButtonClass}
                    >
                        {t('saved.emptyCta')}
                    </Link>
                </div>
            )}

            {!isLoading && !isError && posts.length === 0 && isSearching && (
                <p
                    role="status"
                    aria-live="polite"
                    className="text-sm text-muted-foreground"
                >
                    {t('saved.noResults', { query: debouncedTerm })}
                </p>
            )}

            {!isLoading && !isError && posts.length > 0 && (
                <>
                    <ul className="flex flex-col gap-4">
                        {posts.map((post) => (
                            <li key={post.id}>
                                <RecentPostCard post={post} />
                            </li>
                        ))}
                    </ul>

                    {hasNextPage && (
                        <button
                            type="button"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            aria-busy={isFetchingNextPage}
                            className={cn(ctaButtonClass, 'mt-4 w-full')}
                        >
                            {t('saved.loadMore')}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}
