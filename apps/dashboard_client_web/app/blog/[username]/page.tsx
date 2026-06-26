export const dynamic = 'force-dynamic';

import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { stripUsernameAt } from '@/utils/blog-author';

type PageProps = {
    params: Promise<{ username: string }>;
};

export default async function BlogPage({ params }: PageProps) {
    const { username } = await params;
    const decoded = decodeURIComponent(username);

    return <BlogMainPage username={stripUsernameAt(decoded)} />;
}
