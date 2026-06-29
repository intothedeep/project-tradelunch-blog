import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RecentPostsWidget } from '@/components/rail/RecentPostsWidget.client';
import { TagCloud } from '@/components/rail/TagCloud.server';
import BlogMainPage from '@/app/blog/components/BlogMainPage';

// `/blog` is the ALL-AUTHORS aggregate feed (the global "all posts" surface).
// It lives here — not at `/` — because `/` is temporarily the owner's blog
// (see HOME_FEED_AUTHOR). It mirrors the `(feed)` layout's GLOBAL right rail
// (recently-viewed → global popular-tags fallback) and supplies its own
// BlogShell, since app/blog/layout.tsx is ScrollToTop-only (the per-author
// shell comes from the nested [username]/layout). Per-request rendering so
// `next build` does not fetch the backend at prerender time.
export const dynamic = 'force-dynamic';

// Empty username selects the all-authors feed in getBlogPostsByUsername.
const ALL_AUTHORS = '';

export default function BlogIndex() {
    return (
        <BlogShell
            leftRail={<LeftRailContainer />}
            main={<BlogMainPage username={ALL_AUTHORS} />}
            rightRail={
                <RightRail>
                    <RecentPostsWidget popularTagsFallback={<TagCloud />} />
                </RightRail>
            }
        />
    );
}
