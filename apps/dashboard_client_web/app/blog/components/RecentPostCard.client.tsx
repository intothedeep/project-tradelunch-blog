'use client';

// Purpose: a single recent-post card on /blog/@<username>.
// Invariants: the whole card is ONE navigation target (overlay stretched-link);
//   interactive actions (Like live, Share live, Save live) are siblings at z-10
//   so they never nest inside the anchor (valid HTML, no nested-interactive
//   conflict). Tag chips are likewise SIBLINGS of the overlay anchor (they live
//   in CardContent, not inside the overlay <a>) and are raised to z-10 so they
//   are clickable Links to /tags/<tag> — no nested <a>.
// Constraints: overlay link is omitted when username/slug is missing so the URL
//   never serializes "@undefined". Live like count + viewer state come from the
//   enriched feed read (L5).
// Side effects: none (delegated to action components).

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { MessageSquare } from 'lucide-react';
import { TPost } from '@/apis/blog.types';
import { cn } from '@/lib/utils';
import { PostContentHeader } from '@/app/blog/components/PostContentHeader.server';
import { ShareButton } from '@/app/blog/components/post-card-actions/ShareButton.client';
import { SaveButton } from '@/app/blog/components/post-card-actions/SaveButton.client';
import { LikeButton } from '@/app/blog/components/post-card-actions/LikeButton.client';
import { PostActions } from '@/app/blog/components/post-card-actions/PostActions.client';

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

    // Full category breadcrumb root→leaf; fall back to the single leaf title
    // when the path is absent (uncategorized or a soft-deleted ancestor).
    const categoryPath: string[] =
        post.category_path && post.category_path.length > 0
            ? post.category_path
            : post.category
              ? [post.category]
              : [];

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
                {/* Byline only — actions moved to the engagement footer. */}
                <PostContentHeader post={post} />
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                    {post.title?.toLocaleUpperCase()}
                </h3>

                {/* Category breadcrumb — full root→leaf path. Each segment links
                    to the author's feed filtered to that category title
                    (?category_title=<title>), so any ancestor is browseable too.
                    Raised to z-10 above the card's overlay post link (siblings,
                    never nested). Plain text when there is no addressable author. */}
                {categoryPath.length > 0 && (
                    <div className="relative z-10 mb-3 flex flex-wrap items-center gap-1">
                        {categoryPath.flatMap((seg, i) => {
                            const chip = post.username ? (
                                <Link
                                    key={`seg-${i}`}
                                    href={`/blog/@${post.username}?category_title=${encodeURIComponent(seg)}`}
                                    aria-label={`View posts in ${seg}`}
                                    className={cn(
                                        badgeVariants({ variant: 'outline' }),
                                        'text-xs transition-colors hover:bg-primary hover:text-primary-foreground'
                                    )}
                                >
                                    {seg}
                                </Link>
                            ) : (
                                <Badge
                                    key={`seg-${i}`}
                                    variant="outline"
                                    className="text-xs"
                                >
                                    {seg}
                                </Badge>
                            );
                            return i === 0
                                ? [chip]
                                : [
                                      <span
                                          key={`sep-${i}`}
                                          aria-hidden
                                          className="text-xs text-muted-foreground"
                                      >
                                          ›
                                      </span>,
                                      chip,
                                  ];
                        })}
                    </div>
                )}

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

                {/* Tag chips — Links to /tags/<tag>. Raised to z-10 (relative) so
                    they sit above the overlay anchor and are clickable; they are
                    siblings of that anchor, never nested. */}
                <div
                    className={clsx(
                        'relative z-10 flex items-center gap-1 flex-wrap border-t border-primary/30',
                        'pt-3 mb-3',
                        post.tags?.length ? '' : 'hidden'
                    )}
                >
                    {post.tags?.map((tag, idx) => (
                        <Link
                            key={idx}
                            href={`/tags/${encodeURIComponent(tag)}`}
                            className={cn(
                                badgeVariants({ variant: 'outline' }),
                                'text-xs hover:bg-secondary hover:text-muted-foreground transition-colors'
                            )}
                        >
                            {tag}
                        </Link>
                    ))}
                </div>

                {/* Engagement footer: all controls left-aligned in one row.
                    The comment count is rendered as an action-styled control
                    (a Link to the post → its comments) so it matches the
                    Share/Save/Like buttons; like the others it sits at z-10
                    above the card's overlay nav link. The Like button already
                    carries the aggregate like count, so no separate heart tally
                    is shown. When the post is not addressable (no username/slug)
                    the count degrades to a plain, non-nav indicator. */}
                <div className="flex items-center gap-2">
                    {href ? (
                        <Link
                            href={href}
                            aria-label={`${post.commentCount ?? 0} comments`}
                            className={cn(
                                'relative z-10',
                                'flex items-center justify-center gap-2',
                                'py-2 px-3',
                                'transition-colors border border-primary/30',
                                'text-xs font-semibold',
                                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
                            )}
                        >
                            <MessageSquare size={16} />
                            {post.commentCount ?? 0}
                        </Link>
                    ) : (
                        <span
                            className={cn(
                                'flex items-center justify-center gap-2',
                                'py-2 px-3',
                                'border border-primary/30',
                                'text-xs font-semibold text-muted-foreground'
                            )}
                        >
                            <MessageSquare size={16} />
                            {post.commentCount ?? 0}
                        </span>
                    )}
                    <PostActions>
                        <ShareButton
                            username={post.username}
                            slug={post.slug}
                            title={post.title}
                        />
                        <SaveButton postId={post.id} />
                        <LikeButton
                            postId={post.id}
                            initialLiked={post.viewerLiked ?? false}
                            initialLikeCount={post.likeCount ?? 0}
                        />
                    </PostActions>
                </div>
            </CardContent>
        </Card>
    );
};
