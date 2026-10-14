'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

import { type TPost } from '@/apis/blog.types';
import { RecentPostCard } from '@/components/blog/RecentPostCard.client';
import { getFeedPageClient } from '@/apis/getFeedPage.client.api';

type Props = {
    username: string;
    categories: string[];
    tags: string[];
    initialPosts: TPost[];
    initialCursor: string | null;
    initialHasMore: boolean;
    cdnURL: string;
};

export const RecentPostsListClient: React.FC<Props> = (props) => {
    const {
        username,
        categories,
        tags,
        initialPosts,
        initialCursor,
        initialHasMore,
        cdnURL,
    } = props;

    const [posts, setPosts] = useState(initialPosts);
    const [cursor, setCursor] = useState<string | null>(initialCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isPending, startTransition] = useTransition();
    const [isError, setIsError] = useState(false);
    const t = useTranslations('blog');

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const { getToken } = useAuth();
    // Facet arrays are new refs each render; key the effect on their content.
    const categoriesKey = categories.join(',');
    const tagsKey = tags.join(',');

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
                            const token = await getToken();
                            const data = await getFeedPageClient({
                                cursor,
                                limit: 10,
                                username,
                                categories: categoriesKey
                                    ? categoriesKey.split(',')
                                    : [],
                                tags: tagsKey ? tagsKey.split(',') : [],
                                token,
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
    }, [
        cursor,
        hasMore,
        isPending,
        isError,
        username,
        categoriesKey,
        tagsKey,
        getToken,
    ]);

    return (
        <div
            className={cn(
                'reacent-post-list-container',
                'space-y-3 sm:space-y-4'
            )}
        >
            {posts.map((post, index) => {
                return (
                    <RecentPostCard
                        key={post.id}
                        post={post}
                        cdnBaseUrl={cdnURL}
                        priority={index === 0}
                    />
                );
            })}

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
                    {isPending && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Loading more posts...
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
