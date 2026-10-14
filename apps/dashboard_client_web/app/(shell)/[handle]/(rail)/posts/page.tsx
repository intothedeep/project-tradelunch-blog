import { Suspense } from 'react';
import { User } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

import BlogMainPage from '@/components/blog/BlogMainPage';
import { CategorySidebarWrapper } from '@/components/blog/CategorySidebarWrapper.server';
import { AppliedFilters } from '@/components/blog/filter/AppliedFilters.client';
import { FilterChipRowLeaf } from '@/components/blog/filter/FilterChipRowLeaf.server';
import { MobileCategory } from '@/components/blog/MobileCategory.client';
import { stripUsernameAt } from '@/utils/blog-author';
import { parseFilterState } from '@/utils/filter-state';
import { getUserProfile } from '@/apis/getUserProfile.api';

type PageProps = {
    params: Promise<{ handle: string }>;
    // Multi-facet feed filter: `?categories=a,b&tags=x,y` (same-type OR,
    // cross-type AND). Legacy single `?category_title=` is folded into
    // `categories` by parseFilterState.
    searchParams: Promise<{
        categories?: string;
        tags?: string;
        category_title?: string;
    }>;
};

// Every author self-canonicalizes (query variants like ?categories also fold
// onto the clean author URL). `/` is the all-authors feed, not this page (#81).
export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { handle } = await params;
    const author = stripUsernameAt(decodeURIComponent(handle));
    const canonical = `/@${author}/posts`;

    // Enrich with profile data for richer title/description/og — degrade to
    // raw `author` slug if the profile endpoint is unavailable or unknown user.
    let displayName: string | undefined;
    let postCount: number | undefined;
    try {
        const profile = await getUserProfile(author);
        if (profile) {
            displayName = profile.displayName ?? undefined;
            postCount = profile.postCount ?? undefined;
        }
    } catch (error) {
        unstable_rethrow(error);
        // Non-critical — fall back to raw author slug.
    }

    const resolvedName = displayName ?? author;
    const title = `${resolvedName} — Posts | Taek Lim`;
    const description = `Articles by ${resolvedName}${postCount ? ` — ${postCount} posts` : ''} on finance, markets, and engineering.`;

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            type: 'profile',
            title,
            description,
            url: canonical,
        },
    };
}

export default async function BlogPage({ params, searchParams }: PageProps) {
    const { handle } = await params;
    const sp = await searchParams;
    const author = stripUsernameAt(decodeURIComponent(handle));

    const filters = parseFilterState(sp);

    const t = await getTranslations('blog.filters');

    return (
        <div className="flex flex-col gap-4">
            {/* Title box like the other pages: menu icon + posts tone. */}
            <header className="border border-primary bg-tone-posts p-4">
                <h1 className="flex items-center gap-2 font-mono text-xl font-bold text-primary">
                    <User className="h-5 w-5 shrink-0" />@{author.toUpperCase()}{' '}
                    POSTS
                </h1>
            </header>

            <AppliedFilters username={author} />

            {/* Mobile (<lg): the right rail (with its category tree) is hidden, so
                surface categories as a collapsible accordion — mirroring the post
                TOC ("Contents") on the detail page. Tags stay a chip row. */}
            <div className="mb-3 flex flex-col gap-2 lg:hidden">
                <MobileCategory title={t('categories')}>
                    {/* auth() inside the wrapper is request-time: keep it out
                        of the page's critical path. */}
                    <Suspense fallback={null}>
                        <CategorySidebarWrapper
                            username={author}
                            mode="filter"
                            bare
                        />
                    </Suspense>
                </MobileCategory>
                <Suspense fallback={null}>
                    <FilterChipRowLeaf
                        username={author}
                        ariaLabel={t('tags')}
                    />
                </Suspense>
            </div>

            <div className="border border-primary bg-card p-4">
                <BlogMainPage
                    username={author}
                    filters={filters}
                />
            </div>
        </div>
    );
}
