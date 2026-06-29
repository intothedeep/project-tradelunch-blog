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

// Render BlogMainPage DIRECTLY (no extra padded/centered wrapper) — identical to
// /blog/[username]/page.tsx. BlogShell's <main> already centers + width-caps +
// pads the column, so wrapping again here double-padded `/` relative to the
// author feed. Keeping the structure `main > div > section` identical on both
// routes is what makes the mobile content padding consistent.
export default function Page() {
    return <BlogMainPage username={ALL_AUTHORS} />;
}
