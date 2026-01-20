import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/_components/PostContentHeader.server';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const PostContentCard = async ({ slug }: { slug: string }) => {
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
                <PostContentHeader post={post} hasBack={true} />
            </CardHeader>

            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <MarkdownRenderer content={post.content || ''} />
            </CardContent>
        </Card>
    );
};
