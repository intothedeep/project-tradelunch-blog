import Link from 'next/link';
import { Hash } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getPostsByTag } from '@/apis/getPostsByTag.api';
import { TagPostsList } from '@/components/blog/TagPostsList.client';
import { CDN_ASSETS } from '@/env.schema';

// Global by-tag feed: all posts across all authors carrying `tag`, read live at
// request time (loading.tsx is the Suspense boundary). Already wrapped in
// ContentFrame by (feed)/layout.tsx, so render the feed body only.
// A tag with zero posts is NOT a 404: it shows a tag-miss empty state pointing
// back to popular tags.
//
// cacheComponents needs one sample tag so the shell prerenders with known
// params (usePathname in the global nav is runtime data otherwise). Any other
// tag renders on first request.
export function generateStaticParams() {
    return [{ tag: 'cc-sample' }];
}

export default async function TagFeedPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    const t = await getTranslations('blog');
    const { posts, nextCursor, hasMore } = await getPostsByTag(
        decodedTag,
        undefined,
        20
    );

    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
            {/* Title box like the other pages; Hash stands in for a menu icon. */}
            <header className="border border-primary bg-muted p-4">
                <h1 className="flex items-center gap-2 font-mono text-xl font-bold text-primary">
                    <Hash className="h-5 w-5 shrink-0" />
                    {decodedTag}
                </h1>
            </header>

            {posts.length === 0 ? (
                <div className="rounded-none border border-primary bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        {t('tags.emptyTitle', { tag: decodedTag })}
                    </p>
                    <Link
                        href="/"
                        className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                        {t('tags.browsePopular')}
                    </Link>
                </div>
            ) : (
                <div className="border border-primary bg-card p-4">
                    <TagPostsList
                        tag={decodedTag}
                        initialPosts={posts}
                        initialCursor={nextCursor}
                        initialHasMore={hasMore}
                        cdnURL={CDN_ASSETS}
                    />
                </div>
            )}
        </section>
    );
}
