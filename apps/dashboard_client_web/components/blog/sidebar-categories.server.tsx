// components/blog/sidebar-categories.server.tsx
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { buildCategoryTree } from '@/app/blog/_components/CategoryTree.client';
import { CategoryTree } from '@/components/blog/sidebar-category-tree.server';

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
} from '@/components/ui/sidebar';

type CategorySidebarProps = {
    username: string;
};

export async function CategoriesGroup({ username }: CategorySidebarProps) {
    const { categories } = await getCategoriesByUsername(username);

    if (!categories) {
        return null;
    }

    const tree = buildCategoryTree(categories ?? []);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>CATEGORIES</SidebarGroupLabel>

            <SidebarGroupContent>
                <SidebarMenu>
                    {tree.map((node) => (
                        <CategoryTree
                            key={node.id}
                            node={node}
                            username={username}
                        />
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
