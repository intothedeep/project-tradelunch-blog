'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    buildCategoryTree,
    CategoryTree,
} from '@/app/blog/components/CategoryTree.client';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ETreeNodeType, TTreeNode, TTreeNodeWithChildren } from '@repo/types';
import { buildToggleHref, parseFilterState } from '@/utils/filter-state';

// // ============================================================================
// // CategorySidebar Component
// // ============================================================================

interface CategorySidebarProps {
    categories: TTreeNode[];
    // 'filter' (desktop author rail, Phase 2-filter): clicking a category toggles
    // the per-author `categories` facet instead of single-category navigation.
    // Default 'nav' keeps the legacy `?category_title=` behavior.
    mode?: 'nav' | 'filter';
    // `bare` drops the Card chrome (header/title) and renders only the tree, for
    // nesting inside a labelled container — e.g. the mobile category accordion,
    // where the Collapsible trigger already provides the heading.
    bare?: boolean;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
    categories,
    mode = 'nav',
    bare = false,
}) => {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();

    // Author handle: category nodes may carry a null username, so derive it
    // once from whichever node in the flat tree has it (always a POST node).
    const username: string =
        categories.find((node) => Boolean(node.username))?.username ?? '';

    const handleNodeSelect = (id: string, node: TTreeNodeWithChildren) => {
        setSelectedNode(id);
        // Handle navigation for posts
        if (node.type === ETreeNodeType.POST && node.slug) {
            router.push(`/blog/@${node.username ?? username}/${node.slug}`);
            return;
        }
        // Category: filter the blog feed by this category title.
        if (node.type === ETreeNodeType.CATEGORY && node.title && username) {
            if (mode === 'filter') {
                const current = parseFilterState({
                    categories: searchParams.get('categories') ?? undefined,
                    tags: searchParams.get('tags') ?? undefined,
                    category_title:
                        searchParams.get('category_title') ?? undefined,
                });
                router.push(
                    buildToggleHref(username, current, 'categories', node.title)
                );
                return;
            }
            router.push(
                `/blog/@${username}?category_title=${encodeURIComponent(node.title)}`
            );
        }
    };

    const nodes: TTreeNodeWithChildren[] = buildCategoryTree(categories);

    // Total post count: POST-type nodes in the flat tree data (see
    // CategoryTree.client.tsx — POST nodes are ETreeNodeType.POST leaves).
    const totalPosts: number = categories.filter(
        (node) => node.type === ETreeNodeType.POST
    ).length;

    // Blog title: the author/username carried on any tree node.
    const blogTitle: string = username ? `@${username}` : 'Blog';

    // Active categories from the URL (filter mode): drives the in-place highlight.
    const activeCategories: string[] =
        mode === 'filter'
            ? parseFilterState({
                  categories: searchParams.get('categories') ?? undefined,
                  category_title:
                      searchParams.get('category_title') ?? undefined,
              }).categories
            : [];

    // Bare: tree only (no Card), for the mobile accordion where the Collapsible
    // trigger already labels the section.
    if (bare) {
        return (
            <div className="px-1 pt-2 pb-1">
                <CategoryTree
                    nodes={nodes}
                    selectedNode={selectedNode}
                    onSelectNode={handleNodeSelect}
                    activeTitles={activeCategories}
                />
            </div>
        );
    }

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
                    activeTitles={activeCategories}
                />
            </CardContent>
        </Card>
    );
};
