import { auth } from '@clerk/nextjs/server';
import { getPostBySlug } from '@/apis/getPost.api';
import { TocPublisher } from '@/components/blog/TocPublisher.client';
import { extractTocParsed } from '@/utils/markdown/extractTocParsed';

// Server-extracts the post TOC and publishes it (invisible) into tocItemsAtom so
// the right rail renders it between the profile card and the category section
// (RightRailToc). Renders no visible column itself.
export const PostContentToc = async ({ slug }: { slug: string }) => {
    // Forward the owner's token like PostContentCard does. Without it, an owner
    // viewing their own private post would 404 here, and the throw bubbles past
    // <Suspense> to the segment error boundary — blanking the whole page.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    const post = await getPostBySlug({ slug, token });
    const tocItems = await extractTocParsed(post.content || '');

    return <TocPublisher items={tocItems} />;
};
