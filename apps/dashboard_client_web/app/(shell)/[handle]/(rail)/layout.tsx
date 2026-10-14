import { Suspense } from 'react';
import { UserGate } from '@/components/shell/UserGate.server';
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
    return (
        <ContentFrame
            main={
                <>
                    {/* Unknown user -> 404 view. A layout cannot await uncached
                        data above every Suspense boundary under cacheComponents,
                        so the gate is a leaf: the status stays 200 (noindex). */}
                    <Suspense fallback={null}>
                        <UserGate username={username} />
                    </Suspense>
                    {children}
                </>
            }
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
