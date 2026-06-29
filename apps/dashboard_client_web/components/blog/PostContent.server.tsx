import { Suspense } from 'react';

import { PostContentCard } from '@/components/blog/PostContentCard.server';
import { PostContentToc } from '@/components/blog/PostContentToc.server';
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton';

export const PostContent = ({
    slug,
    ownerUsername,
}: {
    slug: string;
    ownerUsername: string;
}) => {
    return (
        <div>
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
