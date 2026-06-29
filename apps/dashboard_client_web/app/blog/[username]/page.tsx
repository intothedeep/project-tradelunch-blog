export const dynamic = 'force-dynamic';

import Link from 'next/link';

import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { stripUsernameAt } from '@/utils/blog-author';

type PageProps = {
    params: Promise<{ username: string }>;
    // `?category_title=<title>` filters this author's feed to posts in a category
    // with that exact title (titles repeat across parents since migration 0010,
    // so the match intentionally merges same-titled categories).
    searchParams: Promise<{ category_title?: string }>;
};

export default async function BlogPage({ params, searchParams }: PageProps) {
    const { username } = await params;
    const { category_title } = await searchParams;
    const author = stripUsernameAt(decodeURIComponent(username));

    const categoryTitle =
        typeof category_title === 'string' && category_title.length > 0
            ? category_title
            : undefined;

    return (
        <>
            {categoryTitle && (
                <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Category</span>
                    <span className="rounded-full border border-primary px-2.5 py-0.5 font-semibold text-primary">
                        {categoryTitle}
                    </span>
                    <Link
                        href={`/blog/@${author}`}
                        className="text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                    >
                        clear ✕
                    </Link>
                </div>
            )}

            <BlogMainPage
                username={author}
                categoryTitle={categoryTitle}
            />
        </>
    );
}
