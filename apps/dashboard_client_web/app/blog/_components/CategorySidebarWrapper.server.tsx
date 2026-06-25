// app/blog/CategorySidebarWrapper.server.tsx
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { CategorySidebar } from '@/app/blog/_components/CategorySidebar.client';
import { TTreeNodeWithChildren } from '@repo/types';

export const CategorySidebarWrapper = async () => {
    const data: { categories: TTreeNodeWithChildren[] } =
        await getCategoriesByUsername('taeklim');

    // console.log('>> CategorySidebarWrapper: ', data);
    // try {
    //     const data = await getCategoriesByUsername('taeklim');
    //     categories = data.categories;
    // } catch (error) {
    //     console.error('Failed to load categories:', error);
    // }

    return <CategorySidebar categories={data.categories ?? []} />;
};
