import { Suspense } from 'react';

import { PostContentCard } from '@/components/blog/PostContentCard.server';
import { PostContentToc } from '@/components/blog/PostContentToc.server';
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton';
import { MobileToc } from '@/components/blog/MobileToc.client';

export const PostContent = ({
    slug,
    ownerUsername,
}: {
    slug: string;
    ownerUsername: string;
}) => {
    return (
        <div>
            {/* Mobile-only in-article TOC — pinned directly below the mobile
                context chip row and ABOVE the post card (>=lg uses the
                right-rail RightRailToc). Renders nothing when headless. */}
            <div className="mb-3 lg:hidden">
                <MobileToc />
            </div>

            {/* Full-width reading column. */}
            <Suspense fallback={<PostCardSkeleton />}>
                <PostContentCard
                    slug={slug}
                    ownerUsername={ownerUsername}
                />
            </Suspense>

            {/* Invisible: publishes the post TOC to the right rail (RightRailToc),
                between the profile card and the category section. */}
            <Suspense fallback={null}>
                <PostContentToc slug={slug} />
            </Suspense>
        </div>
    );
};

export default PostContent;
