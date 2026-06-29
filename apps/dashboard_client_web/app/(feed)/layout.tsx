import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RecentPostsWidget } from '@/components/rail/RecentPostsWidget.client';
import { TagCloud } from '@/components/rail/TagCloud.server';

// Layout for the global feed route group `(feed)` (URL `/`). Route groups do
// not affect the path. The left rail (P4) is global; the right rail (P5) shows
// the viewer's recently-viewed posts, falling back to a server-rendered GLOBAL
// popular-tags cloud when there are none (never an empty right column).
export default function FeedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <BlogShell
            leftRail={<LeftRailContainer />}
            main={children}
            rightRail={
                <RightRail>
                    <RecentPostsWidget popularTagsFallback={<TagCloud />} />
                </RightRail>
            }
        />
    );
}
