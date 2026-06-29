// app/blog/CategorySidebarWrapper.server.tsx
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { CategorySidebar } from '@/app/blog/components/CategorySidebar.client';
import { TTreeNodeWithChildren } from '@repo/types';

type Props = {
    username: string;
    // 'filter' (desktop author rail): clicking a category toggles the per-author
    // `categories` facet. Default 'nav' keeps legacy single-category navigation.
    mode?: 'nav' | 'filter';
};

export const CategorySidebarWrapper = async ({
    username,
    mode = 'nav',
}: Props) => {
    const data: { categories: TTreeNodeWithChildren[] } =
        await getCategoriesByUsername(username);

    return (
        <CategorySidebar
            categories={data.categories ?? []}
            mode={mode}
        />
    );
};
