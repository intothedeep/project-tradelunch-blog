'use client';

// Purpose: infinite-scroll list of posts for one tag (/tags/[tag]).
// Invariants: cursor is an opaque STRING (Snowflake precision) — kept verbatim,
//   passed straight into the by-tag query, never Number()'d. Modeled on
//   RecentPostsListClient (IntersectionObserver) but scoped by `tag` (no
//   username). Shows a pulse skeleton while a page is in flight (P2.5).
// Side effects: fetches the blog-api. by-tag feed GET directly on intersection.

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

import { type TPost } from '@/apis/blog.types';
import { getTagPageClient } from '@/apis/getFeedPage.client.api';
import { RecentPostCard } from '@/components/blog/RecentPostCard.client';

type Props = {
    tag: string;
    initialPosts: TPost[];
    initialCursor: string | null;
    initialHasMore: boolean;
    cdnURL: string;
};

const FeedSkeleton: React.FC = () => (
    <div className="space-y-3 sm:space-y-4">
        {[0, 1, 2].map((i) => (
            <div
                key={i}
                className="h-40 w-full rounded-md border border-border bg-muted animate-pulse"
            />
        ))}
    </div>
);

export const TagPostsList: React.FC<Props> = (props) => {
    const { tag, initialPosts, initialCursor, initialHasMore, cdnURL } = props;

    const [posts, setPosts] = useState(initialPosts);
    const [cursor, setCursor] = useState<string | null>(initialCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const [isError, setIsError] = useState(false);
    const t = useTranslations('blog');

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // isError: stop the observer so a failing load-more (e.g. 429) is not retried
        // in a loop; the retry button clears it.
        if (!hasMore || isPending || isError) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting && cursor !== null) {
                    startTransition(async () => {
                        try {
                            const data = await getTagPageClient({
                                tag,
                                cursor,
                                limit: 20,
                            });

                            setPosts((prev) => [...prev, ...data.posts]);
                            setCursor(data.nextCursor);
                            setHasMore(data.hasMore);
                        } catch {
                            // Keep the posts already shown; a thrown error here
                            // would reach the error boundary and blank the page.
                            setIsError(true);
                        }
                    });
                }
            },
            { rootMargin: '200px' }
        );

        const currentRef = loadMoreRef.current;
        if (currentRef) observerRef.current.observe(currentRef);

        return () => {
            if (observerRef.current && currentRef)
                observerRef.current.unobserve(currentRef);
        };
    }, [cursor, hasMore, isPending, isError, tag]);

    return (
        <div
            className={cn('tag-post-list-container', 'space-y-3 sm:space-y-4')}
        >
            {posts.map((post, index) => (
                <RecentPostCard
                    key={post.id}
                    post={post}
                    cdnBaseUrl={cdnURL}
                    priority={index === 0}
                />
            ))}

            {isPending && <FeedSkeleton />}

            {hasMore && (
                <div
                    ref={loadMoreRef}
                    className="flex justify-center py-8"
                >
                    {isError && (
                        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                            <p>{t('feed.loadError')}</p>
                            <button
                                type="button"
                                onClick={() => setIsError(false)}
                                className="border border-primary/30 px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                            >
                                {t('feed.retry')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!hasMore && posts.length > 0 && (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                    <p className="text-xs sm:text-sm font-mono">
                        <span className="animate-pulse">▋</span> No more posts
                    </p>
                    <p className="text-xs mt-2">End of feed</p>
                </div>
            )}
        </div>
    );
};
