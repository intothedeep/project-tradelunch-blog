'use client';

// import {
//     ETreeNodeType,
//     TTreeNode,
//     TTreeNodeWithChildren,
// } from '@/apis/blog.types';

import React, { use, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    buildCategoryTree,
    CategoryTree,
} from '@/app/blog/_components/CategoryTree.client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    ETreeNodeType,
    TTreeNode,
    TTreeNodeWithChildren,
} from '@repo/types';

// // ============================================================================
// // CategorySidebar Component
// // ============================================================================

interface CategorySidebarProps {
    categories: TTreeNode[];
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
    categories,
}) => {
    console.log({ categories });
    const [selectedNode, setSelectedNode] = useState<number | null>(null);

    const router = useRouter();

    const handleNodeSelect = (id: number, node: TTreeNodeWithChildren) => {
        setSelectedNode(id);
        console.log('Selected node:', node);
        // Handle navigation for posts
        if (node.type === ETreeNodeType.POST && node.slug) {
            router.push(`/blog/@${node.username}/${node.slug}`);
        }
    };

    const nodes: TTreeNodeWithChildren[] = buildCategoryTree(categories);

    return (
        <Card
            className={cn(
                // 'max-w-2xl',
                'bg-card border-primary'
            )}
        >
            <CardHeader className="p-3 sm:p-4 border-b border-primary/30">
                <CardTitle className="text-primary flex items-center gap-2 text-sm sm:text-base font-mono">
                    <span>&gt;</span> CATEGORIES
                </CardTitle>
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
