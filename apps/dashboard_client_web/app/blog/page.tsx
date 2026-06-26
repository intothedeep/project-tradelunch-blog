import BlogMainPage from '@/app/blog/_components/BlogMainPage';

// Blog index reads live posts from the backend at request time, so it must be
// server-rendered per request (not statically prerendered at build) — matching
// the [username] route. Without this, `next build` tries to fetch the backend
// during prerender and fails when it is unreachable.
export const dynamic = 'force-dynamic';

type Props = {};

export const BlogPage = (props: Props) => {
    return <BlogMainPage />;
};

export default BlogPage;
