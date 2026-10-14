import { Suspense } from 'react';
import { MobileContextHeader } from '@/components/rail/mobile/MobileContextHeader.server';
import { RailCardSkeleton } from '@/components/rail/RailSkeleton';
import { stripUsernameAt } from '@/utils/blog-author';

// Author feed chrome. The frame and the right rail live in the parent
// `(rail)/layout.tsx`; here only the <lg author chip (Phase 2-mobile M1)
// remains. `username` is normalized of any leading '@'.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function PostsLayout({ children, params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));

    return (
        <>
            <div className="mb-3 lg:hidden">
                <Suspense fallback={<RailCardSkeleton rows={1} />}>
                    <MobileContextHeader username={username} />
                </Suspense>
            </div>
            {children}
        </>
    );
}
