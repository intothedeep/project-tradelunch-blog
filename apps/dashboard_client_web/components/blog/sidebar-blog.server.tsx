import * as React from 'react';

import { Sidebar, SidebarContent, SidebarRail } from '@/components/ui/sidebar';
import { CategoriesGroup } from '@/components/blog/sidebar-categories.server';
import Loading from '@/app/blog/[username]/loading';

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
    username: string;
    displayName?: string;
};

export function AppSidebar({ username, ...props }: AppSidebarProps) {
    return (
        <Sidebar {...props}>
            {/* <BlogSidebarheader username={username} displayName={displayName} /> */}

            <SidebarContent>
                <React.Suspense fallback={<Loading />}>
                    <CategoriesGroup username={username} />
                </React.Suspense>
            </SidebarContent>

            <SidebarRail />
        </Sidebar>
    );
}
