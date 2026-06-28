import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/components/PostContentHeader.server';
import { LikeButton } from '@/app/blog/components/post-card-actions/LikeButton.client';
import { SaveButton } from '@/app/blog/components/post-card-actions/SaveButton.client';
import { ShareButton } from '@/app/blog/components/post-card-actions/ShareButton.client';
import { PostActions } from '@/app/blog/components/post-card-actions/PostActions.client';
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
                {/* Byline left; owner Edit + Share + Save + Like top-right. */}
                <div className="flex items-start gap-2">
                    <PostContentHeader
                        post={post}
                        hasBack={true}
                    />
                    <PostActions className="ml-auto">
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
