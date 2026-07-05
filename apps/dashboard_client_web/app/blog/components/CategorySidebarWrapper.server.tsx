// app/blog/CategorySidebarWrapper.server.tsx
import { auth } from '@clerk/nextjs/server';
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { CategorySidebar } from '@/app/blog/components/CategorySidebar.client';
import { TTreeNodeWithChildren } from '@repo/types';

type Props = {
    username: string;
    // 'filter' (desktop author rail): clicking a category toggles the per-author
    // `categories` facet. Default 'nav' keeps legacy single-category navigation.
    mode?: 'nav' | 'filter';
    // `bare` drops the Card chrome — used by the mobile category accordion.
    bare?: boolean;
};

export const CategorySidebarWrapper = async ({
    username,
    mode = 'nav',
    bare = false,
}: Props) => {
    // Resolve the viewer's token so the owner sees their own private posts in
    // the sidebar tree. auth() makes this component render dynamically, which
    // is correct — an authenticated response must never be served from a shared
    // cache to a different viewer.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    const data: { categories: TTreeNodeWithChildren[] } =
        await getCategoriesByUsername(username, token);

    return (
        <CategorySidebar
            categories={data.categories ?? []}
            mode={mode}
            bare={bare}
        />
    );
};
