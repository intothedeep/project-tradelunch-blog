import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/components/PostContentHeader.server';
import { LikeButton } from '@/app/blog/components/post-card-actions/LikeButton.client';
import { SaveButton } from '@/app/blog/components/post-card-actions/SaveButton.client';
import { ShareButton } from '@/app/blog/components/post-card-actions/ShareButton.client';
import { PostActions } from '@/app/blog/components/post-card-actions/PostActions.client';
import { Comments } from '@/app/blog/components/comments/Comments.server';
import { RecordRecentView } from '@/app/blog/components/RecordRecentView.client';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { OwnerEditButton } from '@/components/blog/OwnerEditButton.client';
import { StatusBadge } from '@/components/blog/StatusBadge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const PostContentCard = async ({
    slug,
    ownerUsername,
}: {
    slug: string;
    ownerUsername: string;
}) => {
    // Resolve the Clerk token so the owner can see their own private post.
    // auth() usage opts this component into dynamic rendering — no static cache
    // can accidentally serve private content to anonymous viewers.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    const post = await getPostBySlug({ slug, token });
    const tags: string[] = Array.isArray(post.tags) ? post.tags : [];

    // Record-on-view: minimal summary (id is a STRING — never Number()) feeds
    // the recently-viewed widget (H5.2). Renders nothing.
    const recentSummary = {
        id: String(post.id),
        title: post.title,
        slug: post.slug,
        username: post.username ?? ownerUsername,
        stored_uri: post.stored_uri ?? null,
        likeCount: post.likeCount ?? 0,
        commentCount: post.commentCount ?? 0,
    };

    return (
        <Card
            className={cn(
                'flex-1 min-w-0',
                'bg-card border-primary transition-all group',
                'text-sm'
            )}
        >
            <RecordRecentView post={recentSummary} />
            <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                {/* Byline left; owner Edit + Share + Save + Like top-right. */}
                <div className="flex items-start gap-2">
                    <PostContentHeader
                        post={post}
                        hasBack={true}
                    />
                    <PostActions
                        className="ml-auto"
                        forceDropdown
                    >
                        <OwnerEditButton
                            postId={post.id}
                            ownerUsername={ownerUsername}
                        />
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

                {/* Visibility badge — only rendered when the post is non-public
                    (owner-only by construction: non-owners never receive private
                    posts and therefore never see this badge). */}
                {post.status && post.status !== 'public' && (
                    <div className="mt-1">
                        <StatusBadge status={post.status} />
                    </div>
                )}

                {/* Tag chips — Links to the global by-tag feed. Server component,
                    so plain anchors are fine (not nested in any other anchor). */}
                {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                        {tags.map((tag, idx) => (
                            <Link
                                key={idx}
                                href={`/tags/${encodeURIComponent(tag)}`}
                                className={cn(
                                    badgeVariants({ variant: 'outline' }),
                                    'text-xs hover:bg-secondary hover:text-muted-foreground transition-colors'
                                )}
                            >
                                #{tag}
                            </Link>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <MarkdownRenderer content={post.content || ''} />

                {/* Threaded comments (public read; write requires auth) */}
                <Comments
                    postId={post.id}
                    ownerUsername={ownerUsername}
                />
            </CardContent>
        </Card>
    );
};
