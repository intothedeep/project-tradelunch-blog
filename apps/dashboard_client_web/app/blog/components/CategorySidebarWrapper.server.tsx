// app/blog/CategorySidebarWrapper.server.tsx
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { CategorySidebar } from '@/app/blog/components/CategorySidebar.client';
import { TTreeNodeWithChildren } from '@repo/types';

type Props = {
    username: string;
};

export const CategorySidebarWrapper = async ({ username }: Props) => {
    const data: { categories: TTreeNodeWithChildren[] } =
        await getCategoriesByUsername(username);

    return <CategorySidebar categories={data.categories ?? []} />;
};
