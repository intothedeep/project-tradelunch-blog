import { BlogShell } from '@/components/shell/BlogShell.server';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { UserContextRail } from '@/components/rail/UserContextRail.server';
import { UserContextSheet } from '@/components/rail/UserContextSheet.client';
import { stripUsernameAt } from '@/utils/blog-author';

// Username blog chrome. The left rail (P4) is GLOBAL — identical to `/`. The
// per-user right rail (P5) shows the author's profile + category tree + scoped
// tag cloud; the same content is exposed to <lg viewers via the userContextSheet
// (Q1). `username` is normalized of any leading '@'.
type Props = {
    children: React.ReactNode;
    params: Promise<{ username: string }>;
};

export default async function BlogUsernameLayout({ children, params }: Props) {
    const { username: raw } = await params;
    const username = stripUsernameAt(decodeURIComponent(raw));

    return (
        <BlogShell
            leftRail={<LeftRailContainer />}
            main={children}
            rightRail={
                <RightRail>
                    <UserContextRail username={username} />
                </RightRail>
            }
            userContextSheet={
                <UserContextSheet>
                    <UserContextRail username={username} />
                </UserContextSheet>
            }
        />
    );
}
