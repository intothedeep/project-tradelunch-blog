'use client';

// Projects tree: the `projects` subtree as a navigable tree. Reuses the blog's
// CategoryTree renderer but not the blog sidebar wrapper, whose clicks go to
// blog paths or change the blog filter. Clicks are router.push (no anchors, so
// no prefetch); the highlighted node follows the pathname, not local state.
// Side effects: client navigation only.

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { TTreeNode, TTreeNodeWithChildren } from '@repo/types';
import {
    buildCategoryTree,
    CategoryTree,
} from '@/components/blog/CategoryTree.client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hrefOfNode, selectedNodeIdOf } from '@/utils/projects-tree';

type Props = {
    username: string;
    nodes: TTreeNode[];
    // Drops the Card chrome, for the mobile accordion whose trigger is the title.
    bare?: boolean;
};

export const ProjectsTree = ({ username, nodes, bare = false }: Props) => {
    const router = useRouter();
    const pathname = usePathname();
    const t = useTranslations('blog.projects');
    const tree = useMemo(() => buildCategoryTree(nodes), [nodes]);

    const handleSelect = (id: string, node: TTreeNodeWithChildren) => {
        router.push(hrefOfNode(nodes, node, username));
    };

    const treeView = (
        <CategoryTree
            nodes={tree}
            selectedNode={selectedNodeIdOf(nodes, pathname)}
            onSelectNode={handleSelect}
        />
    );

    if (bare) return <div className="px-1 pt-2 pb-1">{treeView}</div>;

    return (
        <Card className="rounded-none border-primary bg-card">
            <CardHeader className="border-b border-primary/30 p-3 sm:p-4">
                <CardTitle className="flex items-center gap-2 font-mono text-sm text-primary sm:text-base">
                    <span>&gt;</span> {t('treeTitle').toUpperCase()}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pt-2 pb-3">{treeView}</CardContent>
        </Card>
    );
};

export default ProjectsTree;
