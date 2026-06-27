import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/components/PostContentHeader.server';
import { LikeButton } from '@/app/blog/components/post-card-actions/LikeButton.client';
import { Comments } from '@/app/blog/components/comments/Comments.server';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { OwnerEditButton } from '@/components/blog/OwnerEditButton.client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const PostContentCard = async ({
    slug,
    ownerUsername,
}: {
    slug: string;
    ownerUsername: string;
}) => {
    const post = await getPostBySlug({ slug });

    return (
        <Card
            className={cn(
                'flex-1 min-w-0',
                'bg-card border-primary transition-all group',
                'text-sm'
            )}
        >
            <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                <div className="flex items-start gap-2">
                    <PostContentHeader
                        post={post}
                        hasBack={true}
                    />
                    <OwnerEditButton
                        postId={post.id}
                        ownerUsername={ownerUsername}
                    />
                </div>
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <MarkdownRenderer content={post.content || ''} />

                {/* Engagement actions (Like live) */}
                <div className="flex items-center gap-3 flex-wrap border-t border-primary/30 pt-3 mt-3">
                    <LikeButton
                        postId={post.id}
                        initialLiked={post.viewerLiked ?? false}
                        initialLikeCount={post.likeCount ?? 0}
                    />
                </div>

                {/* Threaded comments (public read; write requires auth) */}
                <Comments
                    postId={post.id}
                    ownerUsername={ownerUsername}
                />
            </CardContent>
        </Card>
    );
};
