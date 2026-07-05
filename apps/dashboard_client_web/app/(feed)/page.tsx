import type { Metadata } from 'next';
import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';
import { SITE_URL } from '@/env.schema';

const TITLE = 'Taek Lim — Finance, Markets & Engineering';
const DESCRIPTION =
    'Essays and data on 13F institutional flows, congressional trades, market-cap rankings, and software engineering.';

// Home is the CANONICAL representative for the owner's feed. While single-user,
// `/blog/@<owner>` is duplicate content of `/`, so it canonicalizes here (see
// app/blog/[username]/page.tsx) — consolidating SEO signals onto the home URL.
export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        title: TITLE,
        description: DESCRIPTION,
        url: SITE_URL,
    },
};

// Root of my.prettylog.com. TEMPORARY single-user mode: the home feed focuses on
// HOME_FEED_AUTHOR's blog (the owner) rather than the all-authors aggregate. The
// aggregate "all posts" feed now lives at `/blog`. Set HOME_FEED_AUTHOR='' in
// utils/blog-author.ts to restore the global feed here (then `/` renders the
// all-authors aggregate again, unchanged). Per-request rendering mirrors the
// blog routes so `next build` does not fetch the backend at prerender time. The
// portfolio homepage still lives in `app/MainPage.tsx` (TerminalProfile).
export const dynamic = 'force-dynamic';

// Render BlogMainPage DIRECTLY (no extra padded/centered wrapper) — identical to
// /blog/[username]/page.tsx. BlogShell's <main> already centers + width-caps +
// pads the column, so wrapping again here double-padded `/` relative to the
// author feed. Keeping the structure `main > div > section` identical on both
// routes is what makes the mobile content padding consistent.
export default function Page() {
    return <BlogMainPage username={HOME_FEED_AUTHOR} />;
}
