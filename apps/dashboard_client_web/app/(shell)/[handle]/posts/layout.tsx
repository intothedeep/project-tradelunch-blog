import { notFound } from 'next/navigation';
import { getUserProfile } from '@/apis/getUserProfile.api';
import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { stripUsernameAt } from '@/utils/blog-author';

// Username blog chrome. The left rail (P4) is GLOBAL — identical to `/`. The
// per-user right rail (P5) shows the author's profile + category tree + scoped
// tag cloud. On <lg the same author context is surfaced via the top-of-feed
// MobileContextHeader (author chip + category/tag chip row, Phase 2-mobile M1) —
// which replaces the heavier UserContextSheet (now soft-unwired; the file is kept
// per the repo rm-rf rule). This layout is shared by BOTH the author list page
// and the post-detail route nested under it; unwiring the sheet here also removes
// the duplicate mobile-sheet RightRailToc on detail (M2) — the promoted in-article
// MobileToc is the single mobile TOC. `username` is normalized of any leading '@'.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function PostsLayout({ children, params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    // Unknown user -> real 404. Done in the layout because posts/loading.tsx
    // would flush a 200 shell before the page could call notFound(). A 5xx
    // throws (not null), so only a true 404 reaches notFound().
    if (!(await getUserProfile(username))) notFound();

    return (
        <ContentFrame
            main={children}
            rightRail={
                <RightRail>
                    <UserContextRail username={username} />
                </RightRail>
            }
            mobileTopContext={<MobileContextHeader username={username} />}
        />
    );
}
