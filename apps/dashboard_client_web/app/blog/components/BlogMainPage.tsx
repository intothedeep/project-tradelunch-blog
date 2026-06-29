import { Suspense } from 'react';

import { RecentPostsList } from '@/app/blog/components/RecentPostsList.server';

// ============================================================================
// BlogMainPage Component
// ============================================================================

interface Props {
    username: string;
    categoryTitle?: string;
}

export const BlogMainPage: React.FC<Props> = async ({
    username,
    categoryTitle,
}) => {
    return (
        <section className="relative w-full">
            <Suspense fallback={<div>Recent Posts Loading...</div>}>
                <RecentPostsList
                    username={username}
                    categoryTitle={categoryTitle}
                />
            </Suspense>
        </section>
    );
};

export default BlogMainPage;
