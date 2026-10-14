import { auth } from '@clerk/nextjs/server';

import { getPostBySlug } from '@/apis/getPost.api';
import { preloadCommentsFirstPage } from '@/apis/getCommentsFirstPage.api';

// 404 gate for an unknown post, as a Suspense leaf (cacheComponents). Reads with
// the viewer token (same cache key as PostContentCard) so the owner's private
// post is not 404'd, and starts the first comment page right after the post
// read. Status stays 200 once the shell is out (see UserGate).
export async function PostGate({ slug }: { slug: string }) {
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }
    const post = await getPostBySlug(slug, token);
    preloadCommentsFirstPage(post.id);
    return null;
}
