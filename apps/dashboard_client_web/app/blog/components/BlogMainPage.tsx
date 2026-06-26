import { Suspense } from 'react';

import { RecentPostsList } from '@/app/blog/components/RecentPostsList.server';

// ============================================================================
// BlogMainPage Component
// ============================================================================

interface Props {
    username: string;
}

export const BlogMainPage: React.FC<Props> = async ({ username }) => {
    return (
        <section className="relative w-full">
            <Suspense fallback={<div>Recent Posts Loading...</div>}>
                <RecentPostsList username={username} />
            </Suspense>
        </section>
    );
};

export default BlogMainPage;
