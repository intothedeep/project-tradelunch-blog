// SOFT-DELETED (Phase H P1). Superseded by app/blog/page.tsx which now
// redirects `/blog` -> `/`. Kept for manual verification/removal. Excluded from
// tsconfig (**/x_*) and ignored by Next routing (only `page.tsx` is a route).
// Original content below (referenced the now-removed BlogContentShell):
//
// import BlogMainPage from '@/app/blog/components/BlogMainPage';
// import { BlogContentShell } from '@/app/blog/components/BlogContentShell.server';
// import { DEFAULT_BLOG_AUTHOR } from '@/utils/blog-author';
//
// export const dynamic = 'force-dynamic';
//
// export const BlogPage = () => {
//     return (
//         <BlogContentShell username={DEFAULT_BLOG_AUTHOR}>
//             <BlogMainPage username={DEFAULT_BLOG_AUTHOR} />
//         </BlogContentShell>
//     );
// };
//
// export default BlogPage;

export {};
