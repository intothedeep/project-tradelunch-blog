export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import BlogMainPage from '@/app/blog/components/BlogMainPage';
import { CategorySidebarWrapper } from '@/app/blog/components/CategorySidebarWrapper.server';
import { AppliedFilters } from '@/components/blog/filter/AppliedFilters.client';
import { FilterChipRow } from '@/components/blog/filter/FilterChipRow.client';
import { getTagFilterItems } from '@/components/blog/filter/getFilterItems.server';
import { MobileCategory } from '@/components/blog/MobileCategory.client';
import { HOME_FEED_AUTHOR, stripUsernameAt } from '@/utils/blog-author';
import { parseFilterState } from '@/utils/filter-state';

type PageProps = {
    params: Promise<{ username: string }>;
    // Multi-facet feed filter: `?categories=a,b&tags=x,y` (same-type OR,
    // cross-type AND). Legacy single `?category_title=` is folded into
    // `categories` by parseFilterState.
    searchParams: Promise<{
        categories?: string;
        tags?: string;
        category_title?: string;
    }>;
};

// While `/` is the owner's blog, the owner's author page is duplicate content of
// home → canonicalize it to `/`. Every other author self-canonicalizes (query
// variants like ?categories also fold onto the clean author URL).
export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { username } = await params;
    const author = stripUsernameAt(decodeURIComponent(username));
    const canonical =
        HOME_FEED_AUTHOR && author === HOME_FEED_AUTHOR
            ? '/'
            : `/blog/@${author}`;
    return { alternates: { canonical } };
}

export default async function BlogPage({ params, searchParams }: PageProps) {
    const { username } = await params;
    const sp = await searchParams;
    const author = stripUsernameAt(decodeURIComponent(username));

    const filters = parseFilterState(sp);

    const t = await getTranslations('blog.filters');
    const tagItems = await getTagFilterItems(author);

    return (
        <>
            <AppliedFilters username={author} />

            {/* Mobile (<lg): the right rail (with its category tree) is hidden, so
                surface categories as a collapsible accordion — mirroring the post
                TOC ("Contents") on the detail page. Tags stay a chip row. */}
            <div className="mb-3 flex flex-col gap-2 lg:hidden">
                <MobileCategory title={t('categories')}>
                    <CategorySidebarWrapper
                        username={author}
                        mode="filter"
                        bare
                    />
                </MobileCategory>
                <FilterChipRow
                    username={author}
                    facet="tags"
                    items={tagItems}
                    ariaLabel={t('tags')}
                />
            </div>

            <BlogMainPage
                username={author}
                filters={filters}
            />
        </>
    );
}
