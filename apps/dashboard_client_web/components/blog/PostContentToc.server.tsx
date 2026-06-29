import { getPostBySlug } from '@/apis/getPost.api';
import { TocPublisher } from '@/components/blog/TocPublisher.client';
import { extractTocParsed } from '@/utils/markdown/extractTocParsed';

// Server-extracts the post TOC and publishes it (invisible) into tocItemsAtom so
// the right rail renders it between the profile card and the category section
// (RightRailToc). Renders no visible column itself.
export const PostContentToc = async ({ slug }: { slug: string }) => {
    const post = await getPostBySlug({ slug });
    const tocItems = await extractTocParsed(post.content || '');

    return <TocPublisher items={tocItems} />;
};
