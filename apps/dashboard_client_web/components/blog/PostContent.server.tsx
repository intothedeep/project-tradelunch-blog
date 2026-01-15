import { getPostBySlug } from '@/apis/getPost.api';
import { PostContentHeader } from '@/app/blog/_components/PostContentHeader.server';

import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { TableOfContents } from '@/components/blog/TableOfContents.client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { extractToc } from '@repo/markdown-parsing';

export const PostContent = async ({ slug }: { slug: string }) => {
    const post = await getPostBySlug({ slug });

    // Extract TOC from markdown content
    const tocItems = extractToc(post.content || '');

    return (
        <div className="flex gap-6">
            {/* Main Content */}
            <Card
                className={cn(
                    'flex-1 min-w-0', // min-w-0 prevents flex child overflow
                    'bg-card border-primary transition-all group',
                    'text-sm'
                )}
            >
                <CardHeader className={cn('p-3 pb-0 sm:p-4 sm:pb-0')}>
                    <PostContentHeader
                        post={post}
                        hasBack={true}
                    />
                </CardHeader>

                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <MarkdownRenderer content={post.content || ''} />
                </CardContent>
            </Card>

            {/* Sticky TOC Sidebar - Hidden on mobile, visible on lg */}
            {tocItems.length > 0 && (
                <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
                    <div className="sticky top-4">
                        <TableOfContents
                            items={tocItems}
                            className="my-0"
                        />
                    </div>
                </aside>
            )}
        </div>
    );
};

export default PostContent;
