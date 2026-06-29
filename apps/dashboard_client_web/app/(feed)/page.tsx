import BlogMainPage from '@/app/blog/components/BlogMainPage';

// Root of my.prettylog.com is the global blog feed: all posts across all
// authors, read live from the backend at request time (GET /v1/api/posts).
// No category sidebar here — category trees are per-author only (there is no
// global categories endpoint), so the per-author sidebar stays on
// /blog/[username]. Per-request rendering mirrors the blog routes so
// `next build` does not fetch the backend at prerender time. The portfolio
// homepage still lives in `app/MainPage.tsx` (TerminalProfile).
export const dynamic = 'force-dynamic';

// Empty username selects the all-authors feed in getBlogPostsByUsername.
const ALL_AUTHORS = '';

export default function Page() {
    return (
        <section className="mx-auto w-full max-w-3xl p-4">
            <BlogMainPage username={ALL_AUTHORS} />
        </section>
    );
}
