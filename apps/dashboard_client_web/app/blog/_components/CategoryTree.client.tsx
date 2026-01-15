'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import {
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    FolderOpen,
} from 'lucide-react';

import { ETreeNodeType, TTreeNode, TTreeNodeWithChildren } from '@repo/markdown-parsing/types';

// ============================================================================
// Utils - Build Tree from Flat Data
// ============================================================================
export function buildCategoryTree(
    flatData: TTreeNode[]
): TTreeNodeWithChildren[] {
    if (!flatData.length) return [];

    const nodeMap = new Map<number, TTreeNodeWithChildren>();

    flatData.forEach((node) => {
        nodeMap.set(node.id, {
            ...node,
            children: [],
            postCount: 0,
        });
    });

    const roots: TTreeNodeWithChildren[] = [];

    for (const [key, treeNode] of nodeMap) {
        // console.log({ key, treeNode });

        if (!treeNode.parent_id || treeNode.parent_id === treeNode.id) {
            roots.push(treeNode);
        } else {
            const parent = nodeMap.get(treeNode.parent_id);

            if (parent) {
                parent.children!.push(treeNode);
            } else {
                roots.push(treeNode);
            }
        }
    }

    const calculatePostCount = (node: TTreeNodeWithChildren): number => {
        if (node.type === ETreeNodeType.POST) {
            return 1;
        }

        let count = 0;
        if (node.children) {
            node.children.forEach((child) => {
                count += calculatePostCount(child);
            });
        }
        node.postCount = count;
        return count;
    };

    roots.forEach(calculatePostCount);

    return roots;
}

// ============================================================================
// VSCode Style Category Tree Component
// ============================================================================
interface CategoryTreeProps {
    nodes: TTreeNodeWithChildren[];
    level?: number;
    selectedNode: number | null;
    onSelectNode: (id: number, node: TTreeNodeWithChildren) => void;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
    nodes,
    level = 0,
    selectedNode,
    onSelectNode,
}) => {
    const [localExpanded, setLocalExpanded] = useState<Record<number, boolean>>(
        {}
    );

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setLocalExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <nav
            aria-label="Blog Categories"
            className={`space-y-0.5 ${level > 0 ? 'ml-3 border-l-1 border-primary/30 pl-1' : ''}`}
        >
            {nodes.map((node) => {
                const isExpanded = localExpanded[node.id] || true;
                const hasChildren = node.children && node.children.length > 0;
                const isPost = node.type === ETreeNodeType.POST;
                const isSelected = selectedNode === node.id;

                return (
                    <div key={node.id}>
                        <button
                            onClick={(e) => {
                                if (hasChildren) {
                                    toggleExpand(node.id, e);
                                }
                                onSelectNode(node.id, node);
                            }}
                            className={cn(
                                'w-full flex items-center',
                                'gap-1.5 px-1 py-1',
                                'text-xs',
                                'hover:bg-primary hover:text-primary-foreground transition-colors',
                                'group',
                                { 'bg-secondary text-foreground': isSelected }
                            )}
                        >
                            {/* Expand/Collapse Icon */}
                            {hasChildren && (
                                <span className="flex-shrink-0 text-muted-foreground group-hover:text-primary-foreground">
                                    {isExpanded ? (
                                        <ChevronDown size={16} />
                                    ) : (
                                        <ChevronRight size={16} />
                                    )}
                                </span>
                            )}

                            {/* Spacing for items without children */}
                            {/* {!hasChildren && (
                                <span className="w-4 flex-shrink-0" />
                            )} */}

                            {/* Icon based on type */}
                            <span className="flex-shrink-0 text-muted-foreground group-hover:text-primary-foreground">
                                {isPost ? (
                                    <FileText size={16} />
                                ) : isExpanded ? (
                                    <FolderOpen size={16} />
                                ) : (
                                    <Folder size={16} />
                                )}
                            </span>

                            {/* Title */}
                            <span className="flex-1 text-left truncate text-xs">
                                {node.title?.toLocaleUpperCase()}
                            </span>

                            {/* Post Count Badge */}
                            {!isPost &&
                                node.postCount !== undefined &&
                                node.postCount > 0 && (
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'text-xs px-1.5 py-0 h-5 flex-shrink-0 group-hover:opacity-100',
                                            'group-hover:text-primary-foreground',
                                            'text-muted-foreground'
                                        )}
                                    >
                                        {node.postCount}
                                    </Badge>
                                )}
                        </button>

                        {/* Recursive Children */}
                        {hasChildren && isExpanded && (
                            <CategoryTree
                                nodes={node.children!}
                                level={level + 1}
                                selectedNode={selectedNode}
                                onSelectNode={onSelectNode}
                            />
                        )}
                    </div>
                );
            })}
        </nav>
    );
};
