// components/CategoryTree.tsx
'use client';

import { ChevronRight, Folder, File } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { TreeNode } from '@/utils/tree.utils';

type CategoryTreeProps = {
    node: TreeNode;
    username: string;
};

export function CategoryTree({ node, username }: CategoryTreeProps) {
    const hasChildren = node.children.length > 0;
    const pathname = usePathname();
    const pathSegments = pathname.split('/'); // TODO no slug?
    const currentSlug = pathSegments[pathSegments.length - 1];

    if (!hasChildren) {
        return (
            <SidebarMenuItem>
                <Link href={`/blog/@${username}/${node.slug}`}>
                    <SidebarMenuButton
                        isActive={node.slug === currentSlug}
                        className="data-[active=true]:bg-transparent"
                    >
                        <File />
                        <span>{node.title}</span>
                    </SidebarMenuButton>
                </Link>

                {node.postCount > 0 && (
                    <SidebarMenuBadge>{node.postCount}</SidebarMenuBadge>
                )}
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <Collapsible
                className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
                // TODO: open logic
                // defaultOpen={node.level === 0}
                defaultOpen={true}
            >
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                        <ChevronRight className="transition-transform" />
                        <Folder />
                        <span>{node.title}</span>
                    </SidebarMenuButton>
                </CollapsibleTrigger>

                {node.postCount > 0 && (
                    <SidebarMenuBadge>{node.postCount}</SidebarMenuBadge>
                )}

                <CollapsibleContent>
                    <SidebarMenuSub>
                        {node.children.map((child) => (
                            <CategoryTree
                                key={child.id}
                                node={child}
                                username={username}
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}
