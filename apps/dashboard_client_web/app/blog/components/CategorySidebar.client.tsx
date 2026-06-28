'use client';

// import {
//     ETreeNodeType,
//     TTreeNode,
//     TTreeNodeWithChildren,
// } from '@/apis/blog.types';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    buildCategoryTree,
    CategoryTree,
} from '@/app/blog/components/CategoryTree.client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ETreeNodeType, TTreeNode, TTreeNodeWithChildren } from '@repo/types';

// // ============================================================================
// // CategorySidebar Component
// // ============================================================================

interface CategorySidebarProps {
    categories: TTreeNode[];
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
    categories,
}) => {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    const router = useRouter();

    const handleNodeSelect = (id: string, node: TTreeNodeWithChildren) => {
        setSelectedNode(id);
        // Handle navigation for posts
        if (node.type === ETreeNodeType.POST && node.slug) {
            router.push(`/blog/@${node.username}/${node.slug}`);
        }
    };

    const nodes: TTreeNodeWithChildren[] = buildCategoryTree(categories);

    // Total post count: POST-type nodes in the flat tree data (see
    // CategoryTree.client.tsx — POST nodes are ETreeNodeType.POST leaves).
    const totalPosts: number = categories.filter(
        (node) => node.type === ETreeNodeType.POST
    ).length;

    // Blog title: the author/username carried on any tree node.
    const username: string =
        categories.find((node) => Boolean(node.username))?.username ?? '';
    const blogTitle: string = username ? `@${username}` : 'Blog';

    return (
        <Card
            className={cn(
                // 'max-w-2xl',
                'bg-card border-primary'
            )}
        >
            <CardHeader className="p-3 sm:p-4 border-b border-primary/30 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-primary text-sm sm:text-base font-mono truncate">
                        {blogTitle}
                    </CardTitle>
                    <span className="text-primary/80 text-xs sm:text-sm font-mono flex-shrink-0">
                        {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
                    </span>
                </div>
                <p className="text-primary/60 flex items-center gap-2 text-xs font-mono">
                    <span>&gt;</span> CATEGORIES
                </p>
            </CardHeader>

            <CardContent className="px-1 pt-2 pb-3">
                <CategoryTree
                    nodes={nodes}
                    selectedNode={selectedNode}
                    onSelectNode={handleNodeSelect}
                />
            </CardContent>
        </Card>
    );
};
