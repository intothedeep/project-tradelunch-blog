'use client';

// Purpose: a single recent-post card on /blog/@<username>.
// Invariants: the whole card is ONE navigation target (overlay stretched-link);
//   interactive actions (Like live, Share live, Save live) are siblings at z-10
//   so they never nest inside the anchor (valid HTML, no nested-interactive
//   conflict).
// Constraints: overlay link is omitted when username/slug is missing so the URL
//   never serializes "@undefined". Live like count + viewer state come from the
//   enriched feed read (L5).
// Side effects: none (delegated to action components).

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { TPost } from '@/apis/blog.types';
import { cn } from '@/lib/utils';
import { PostContentHeader } from '@/app/blog/components/PostContentHeader.server';
import { ShareButton } from '@/app/blog/components/post-card-actions/ShareButton.client';
import { SaveButton } from '@/app/blog/components/post-card-actions/SaveButton.client';
import { LikeButton } from '@/app/blog/components/post-card-actions/LikeButton.client';

interface RecentPostCardProps {
    post: TPost;
    cdnBaseUrl?: string;
}

export const RecentPostCard: React.FC<RecentPostCardProps> = ({
    post,
    cdnBaseUrl = '',
}) => {
    // stored_uri is already an absolute URL (post-publish); only prefix the CDN
    // base for legacy bare-key values.
    const imageUrl = post.stored_uri
        ? /^https?:\/\//.test(post.stored_uri)
            ? post.stored_uri
            : `${cdnBaseUrl}/${post.stored_uri}`
        : null;

    // Omit the overlay link when either segment is missing → no "@undefined".
    const href =
        post.username && post.slug
            ? `/blog/@${post.username}/${post.slug}`
            : null;

    return (
        <Card
            className={cn(
                'relative',
                'lg:max-w-2xl',
                'bg-card border-primary transition-all group',
                'hover:shadow-primary hover:shadow-xs hover:border-primary hover:bg-secondary'
            )}
        >
            {href && (
                <Link
                    href={href}
                    aria-label={post.title}
                    className="absolute inset-0 z-0 hover:cursor-pointer"
                />
            )}

            <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                {/* Byline left; Like + Save pinned top-right (z-10 siblings so
                    they never nest inside the card's overlay nav link). */}
                <div className="flex items-start justify-between gap-2">
                    <PostContentHeader post={post} />
                    <div className="flex items-center gap-2 shrink-0">
                        <LikeButton
                            postId={post.id}
                            initialLiked={post.viewerLiked ?? false}
                            initialLikeCount={post.likeCount ?? 0}
                        />
                        <SaveButton postId={post.id} />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                    {post.title?.toLocaleUpperCase()}
                </h3>

                {/* Category Badge */}
                <Badge
                    variant="outline"
                    className="mb-3 text-xs"
                >
                    {post.category}
                </Badge>

                {/* Image */}
                {imageUrl && (
                    <div className="relative w-full aspect-video mb-3 rounded border border-primary/30 overflow-hidden bg-muted">
                        <Image
                            src={imageUrl}
                            alt={post.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            loading="lazy"
                        />
                    </div>
                )}

                {/* Description */}
                {post.description && (
                    <p className="text-xs font-semibold sm:text-sm text-foreground line-clamp-3 mb-3">
                        {post.description}
                    </p>
                )}

                {/* Tag Badges */}
                <div
                    className={clsx(
                        'flex items-center gap-1 flex-wrap border-t border-primary/30',
                        'pt-3 mb-3',
                        post.tags?.length ? '' : 'hidden'
                    )}
                >
                    {post.tags?.map((tag, idx) => (
                        <Badge
                            key={idx}
                            variant="outline"
                            className={clsx(
                                'text-xs',
                                'hover:text-muted-foreground transition-colors'
                            )}
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>

                {/* Footer - Actions (Share live; Like + Save moved to header) */}
                <div className="flex items-center gap-3 flex-wrap border-t border-primary/30 pt-3">
                    <ShareButton
                        username={post.username}
                        slug={post.slug}
                        title={post.title}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
