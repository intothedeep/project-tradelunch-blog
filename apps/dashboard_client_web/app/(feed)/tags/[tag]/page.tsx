import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getPostsByTag } from '@/apis/getPostsByTag.api';
import { TagPostsList } from '@/app/blog/components/TagPostsList.client';
import { CDN_ASSETS } from '@/env.schema';

// Global by-tag feed: all posts across all authors carrying `tag`, read live at
// request time. Already wrapped in BlogShell by (feed)/layout.tsx — render the
// feed body only. A tag with zero posts is NOT a 404: it shows a tag-miss empty
// state pointing back to popular tags.
export const dynamic = 'force-dynamic';

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
        <section className="mx-auto w-full max-w-3xl p-4">
            <h1 className="mb-4 text-xl font-bold text-foreground">
                #{decodedTag}
            </h1>

            {posts.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-8 text-center">
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
                <TagPostsList
                    tag={decodedTag}
                    initialPosts={posts}
                    initialCursor={nextCursor}
                    initialHasMore={hasMore}
                    cdnURL={CDN_ASSETS}
                />
            )}
        </section>
    );
}
