import type { Metadata } from 'next';
import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { SITE_URL } from '@/env.schema';

const TITLE = 'Taek Lim — Software Engineering & Backend';
const DESCRIPTION =
    'Technical blog and portfolio by Taek Lim. Topics: software engineering, backend systems, and web development.';

// Home is the all-authors feed (#81); it is its own canonical.
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

// Root of my.prettylog.com: the ALL-AUTHORS feed (empty username selects it in
// getBlogPostsByUsername). Per-request rendering so `next build` does not fetch
// the backend at prerender time. BlogShell's <main> already centers + width-caps
// + pads the column, so BlogMainPage is rendered directly, with no extra wrapper.
export const dynamic = 'force-dynamic';

const ALL_AUTHORS = '';

export default function Page() {
    return <BlogMainPage username={ALL_AUTHORS} />;
}
