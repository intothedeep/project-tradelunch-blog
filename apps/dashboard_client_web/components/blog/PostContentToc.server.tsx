import { getPostBySlug } from '@/apis/getPost.api';
import { TableOfContents } from '@/components/blog/TableOfContents.client';
import { extractTocParsed } from '@repo/markdown-parsing';

export const PostContentToc = async ({ slug }: { slug: string }) => {
    const post = await getPostBySlug({ slug });
    const tocItems = await extractTocParsed(post.content || '');

    if (tocItems.length === 0) return null;

    return (
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-4">
                <TableOfContents items={tocItems} className="my-0" />
            </div>
        </aside>
    );
};
