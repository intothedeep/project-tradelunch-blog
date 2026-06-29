'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

import { type TPost } from '@/apis/blog.types';
import { RecentPostCard } from '@/app/blog/components/RecentPostCard.client';
import { serializeFacet } from '@/utils/filter-state';

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

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const categoriesParam = serializeFacet(categories);
    const tagsParam = serializeFacet(tags);

    useEffect(() => {
        if (!hasMore || isPending) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting && cursor !== null) {
                    startTransition(async () => {
                        const facetParams = [
                            categoriesParam
                                ? `&categories=${categoriesParam}`
                                : '',
                            tagsParam ? `&tags=${tagsParam}` : '',
                        ].join('');
                        const res = await fetch(
                            `/api/posts/load-more?cursor=${cursor}&limit=10&username=${username}${facetParams}`
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
    }, [cursor, hasMore, isPending, username, categoriesParam, tagsParam]);

    return (
        <div
            className={cn(
                'reacent-post-list-container',
                'space-y-3 sm:space-y-4'
            )}
        >
            {posts.map((post) => {
                return (
                    <RecentPostCard
                        key={post.id}
                        post={post}
                        cdnBaseUrl={cdnURL}
                    />
                );
            })}

            {hasMore && (
                <div
                    ref={loadMoreRef}
                    className="flex justify-center py-8"
                >
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
