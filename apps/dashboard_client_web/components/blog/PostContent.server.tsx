import { Suspense } from 'react';

import { PostContentCard } from '@/components/blog/PostContentCard.server';
import { PostContentToc } from '@/components/blog/PostContentToc.server';
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton';
import { PostTocSkeleton } from '@/components/blog/PostTocSkeleton';

export const PostContent = ({ slug }: { slug: string }) => {
    return (
        <div className="flex gap-6">
            {/* Main Content with Suspense */}
            <Suspense fallback={<PostCardSkeleton />}>
                <PostContentCard slug={slug} />
            </Suspense>

            {/* TOC Sidebar with Suspense */}
            <Suspense fallback={<PostTocSkeleton />}>
                <PostContentToc slug={slug} />
            </Suspense>
        </div>
    );
};

export default PostContent;
