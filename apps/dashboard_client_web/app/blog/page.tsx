import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { BlogContentShell } from '@/app/blog/components/BlogContentShell.server';
import { DEFAULT_BLOG_AUTHOR } from '@/utils/blog-author';

// Blog index reads live posts from the backend at request time, so it must be
// server-rendered per request (not statically prerendered at build) — matching
// the [username] route. Without this, `next build` tries to fetch the backend
// during prerender and fails when it is unreachable.
export const dynamic = 'force-dynamic';

export const BlogPage = () => {
    return (
        <BlogContentShell username={DEFAULT_BLOG_AUTHOR}>
            <BlogMainPage username={DEFAULT_BLOG_AUTHOR} />
        </BlogContentShell>
    );
};

export default BlogPage;
