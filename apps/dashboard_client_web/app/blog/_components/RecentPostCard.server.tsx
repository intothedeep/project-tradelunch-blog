import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, MessageSquare, Share2, Star } from 'lucide-react';
import Image from 'next/image';
import { TPost } from '@/apis/blog.types';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================
// interface RecentPost {
//     title: string;
//     description: string;
//     category: string;
//     date: string;
//     readTime?: string;
//     stored_uri?: string;
//     upvotes?: number;
//     comments?: number;
//     author?: string;
// }

// ============================================================================
// VoteBlock Component
// ============================================================================
interface VoteBlockProps {
    upvotes: number;
    onUpvote?: () => void;
    onDownvote?: () => void;
}

export const VoteBlock: React.FC<VoteBlockProps> = ({
    upvotes,
    onUpvote,
    onDownvote,
}) => {
    return (
        <div
            className={cn(
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <button
                onClick={onUpvote}
                aria-label="Upvote"
            >
                <ArrowUp size={16} />
            </button>

            <span className="min-w-[1rem] text-center">{upvotes}</span>

            <button
                onClick={onDownvote}
                aria-label="Downvote"
            >
                <ArrowDown size={16} />
            </button>
        </div>
    );
};

// ============================================================================
// CommentsBlock Component
// ============================================================================
interface CommentsBlockProps {
    count: number;
    onClick?: () => void;
}

export const CommentsBlock: React.FC<CommentsBlockProps> = ({
    count,
    onClick,
}) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <MessageSquare size={16} />
            <span>{count}</span>
        </button>
    );
};

// ============================================================================
// ShareBlock Component
// ============================================================================
interface ShareBlockProps {
    onShare?: () => void;
}

export const ShareBlock: React.FC<ShareBlockProps> = ({ onShare }) => {
    return (
        <button
            onClick={onShare}
            className={cn(
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <Share2 size={16} />
            <span>SAHRE</span>
        </button>
    );
};

interface SaveBlockProps {
    onSave?: () => void;
}

export const SaveBlock: React.FC<SaveBlockProps> = ({ onSave }) => {
    return (
        <button
            className={cn(
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
            onClick={onSave}
        >
            <Star size={16} />
            <span>SAVE</span>
        </button>
    );
};

import Link from 'next/link';
import { PostContentHeader } from '@/app/blog/_components/PostContentHeader.server';
import clsx from 'clsx';

// ============================================================================
// RecentPostCard Component
// ============================================================================
interface RecentPostCardProps {
    post: TPost;
    cdnBaseUrl?: string;
    onUpvote?: () => void;
    onDownvote?: () => void;
    onCommentClick?: () => void;
    onShare?: () => void;
}

export const RecentPostCard: React.FC<RecentPostCardProps> = ({
    post,
    cdnBaseUrl = '',
    onUpvote,
    onDownvote,
    onCommentClick,
    onShare,
}) => {
    const imageUrl = post.stored_uri
        ? `${cdnBaseUrl}/${post.stored_uri}`
        : null;

    const upvotes = post.upvotes ?? 410;
    const comments = post.comments ?? 3;

    return (
        <Card
            className={cn(
                'lg:max-w-2xl',
                'bg-card border-primary transition-all group',
                'hover:shadow-primary hover:shadow-xs hover:border-primary hover:bg-secondary'
            )}
        >
            <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                <PostContentHeader post={post} />
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {/* Header - Author & Metadata */}

                <Link
                    href={`/blog/@${post.username}/${post.slug}`}
                    className={cn('hover:cursor-pointer')}
                >
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

                    {/* Footer - Vote + Actions */}
                    <div className="flex items-center gap-3 flex-wrap border-t border-primary/30 pt-3">
                        <VoteBlock
                            upvotes={upvotes}
                            onUpvote={onUpvote}
                            onDownvote={onDownvote}
                        />
                        <div className="h-6 w-px bg-primary/30" />
                        <CommentsBlock
                            count={comments}
                            onClick={onCommentClick}
                        />
                        <ShareBlock onShare={onShare} />
                        <SaveBlock onSave={() => {}} />
                    </div>
                </Link>
            </CardContent>
        </Card>
    );
};
