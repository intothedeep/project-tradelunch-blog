import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { RecentPostsWidget } from '@/components/rail/RecentPostsWidget.client';
import { TagCloud } from '@/components/rail/TagCloud.server';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';

// Layout for the global feed route group `(feed)` (URL `/`). Route groups do
// not affect the path. The left rail (P4) is global.
//
// TEMPORARY single-user mode: when HOME_FEED_AUTHOR is set, `/` mirrors the
// /blog/@<author> chrome — the per-user right rail (author profile + category
// tree + scoped tags) plus the <lg MobileContextHeader (author chip + category/
// tag chip row, Phase 2-mobile M1 — replaces the heavier UserContextSheet) — so
// the home reads as the owner's blog. With HOME_FEED_AUTHOR='' it reverts to the
// global right rail (the viewer's recently-viewed posts, falling back to a GLOBAL
// popular-tags cloud when there are none, never an empty right column).
export default function FeedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    if (HOME_FEED_AUTHOR) {
        return (
            <BlogShell
                leftRail={<LeftRailContainer />}
                main={children}
                rightRail={
                    <RightRail>
                        <UserContextRail username={HOME_FEED_AUTHOR} />
                    </RightRail>
                }
                mobileTopContext={
                    <MobileContextHeader username={HOME_FEED_AUTHOR} />
                }
            />
        );
    }

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
