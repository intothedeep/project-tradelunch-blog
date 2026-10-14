import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RecentPostsWidget } from '@/components/rail/RecentPostsWidget.client';
import { TagCloud } from '@/components/rail/TagCloud.server';

// Layout for the global feed route group `(feed)` (URL `/`). Route groups do
// not affect the path. `/` is the all-authors feed (#81): the left rail is
// global and the right rail is the viewer's recently-viewed posts, falling back
// to a GLOBAL popular-tags cloud when there are none (never an empty column).
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
