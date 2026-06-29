'use client';

// Purpose: infinite-scroll list of posts for one tag (/tags/[tag]).
// Invariants: cursor is an opaque STRING (Snowflake precision) — kept verbatim,
//   passed straight into the load-more query, never Number()'d. Modeled on
//   RecentPostsListClient (IntersectionObserver) but scoped by `tag` (no
//   username). Shows a pulse skeleton while a page is in flight (P2.5).
// Side effects: fetches /api/posts/load-more on intersection.

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

import { type TPost } from '@/apis/blog.types';
import { RecentPostCard } from '@/app/blog/components/RecentPostCard.client';

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

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasMore || isPending) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting && cursor !== null) {
                    startTransition(async () => {
                        const res = await fetch(
                            `/api/posts/load-more?cursor=${cursor}&limit=20&tag=${encodeURIComponent(
                                tag
                            )}`
                        );

                        const data = await res.json();

                        setPosts((prev) => [...prev, ...data.posts]);
                        setCursor(data.nextCursor);
                        setHasMore(data.hasMore);
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
    }, [cursor, hasMore, isPending, tag]);

    return (
        <div
            className={cn('tag-post-list-container', 'space-y-3 sm:space-y-4')}
        >
            {posts.map((post) => (
                <RecentPostCard
                    key={post.id}
                    post={post}
                    cdnBaseUrl={cdnURL}
                />
            ))}

            {isPending && <FeedSkeleton />}

            {hasMore && (
                <div
                    ref={loadMoreRef}
                    className="flex justify-center py-8"
                />
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
