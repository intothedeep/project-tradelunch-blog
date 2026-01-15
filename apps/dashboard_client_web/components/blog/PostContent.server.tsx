import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/_components/PostContentHeader.server';

import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { TableOfContents } from '@/components/blog/TableOfContents.server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { extractToc } from '@repo/markdown-parsing';

export const PostContent = async ({ slug }: { slug: string }) => {
    const post = await getPostBySlug({ slug });

    // Extract TOC from markdown content
    const tocItems = extractToc(post.content || '');

    return (
        <>
            <Card
                className={cn(
                    // 'max-w-2xl',
                    'bg-card border-primary transition-all group',
                    'text-sm'
                    // 'hover:shadow-primary hover:shadow-xs hover:border-primary hover:bg-secondary'
                )}
            >
                <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                    <PostContentHeader
                        post={post}
                        hasBack={true}
                    />
                </CardHeader>

                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    {tocItems.length > 0 && (
                        <TableOfContents items={tocItems} />
                    )}
                    <MarkdownRenderer content={post.content || ''} />
                </CardContent>
            </Card>
        </>
    );
};

export default PostContent;

