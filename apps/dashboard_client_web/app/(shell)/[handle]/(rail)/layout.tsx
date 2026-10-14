import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUserProfile } from '@/apis/getUserProfile.api';
import { ContentFrame } from '@/components/shell/ContentFrame.server';
import { RightRail } from '@/components/rail/RightRail.client';
import { HomeRightRail } from '@/components/rail/HomeRightRail.server';
import { PostsProfileSlot } from '@/components/rail/PostsProfileSlot.client';
import { UserProfileCard } from '@/components/rail/UserProfileCard.server';
import { ProfileCardSkeleton } from '@/components/rail/RailSkeleton';
import { stripUsernameAt } from '@/utils/blog-author';

// Shared right rail of /@u/posts, /@u/projects(/<p>) and /@u/saved (#93): one
// HomeRightRail instance for the whole `(rail)` group, so it survives moves
// between these screens. The profile card is rendered here by the server and
// shown by a client slot on /@u/posts only (Q15). Excluded on purpose: post
// detail, about, resume and me live outside this group.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function RailGroupLayout({ children, params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    // Unknown user -> real 404. Done in the layout because the posts
    // loading.tsx would flush a 200 shell before the page could call
    // notFound(). A 5xx throws (not null), so only a true 404 reaches here.
    if (!(await getUserProfile(username))) notFound();

    return (
        <ContentFrame
            main={children}
            rightRail={
                <RightRail>
                    <PostsProfileSlot
                        card={
                            <Suspense fallback={<ProfileCardSkeleton />}>
                                <UserProfileCard username={username} />
                            </Suspense>
                        }
                    />
                    <HomeRightRail username={username} />
                </RightRail>
            }
        />
    );
}
