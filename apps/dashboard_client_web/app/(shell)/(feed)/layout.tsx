import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { HomeRightRail } from '@/components/rail/HomeRightRail.server';

// Layout for the global feed route group `(feed)` (URL `/`). Route groups do
// not affect the path. `/` is the all-authors feed (#81): the left rail is
// global; the right rail is the owner's projects + categories trees and the
// viewer's recents (HomeRightRail).
export default function FeedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ContentFrame
            main={children}
            rightRail={
                <RightRail>
                    <HomeRightRail />
                </RightRail>
            }
        />
    );
}
