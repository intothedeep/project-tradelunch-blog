import {
    ETreeNodeType,
    TCategoryTreeNode,
    TPostTreeNode,
    TTreeNode,
    TTreeNodeWithChildren,
} from '@repo/types';

// utils/tree.utils.ts
export const buildTree = (flatData: TTreeNode[]): TTreeNodeWithChildren[] => {
    const map = new Map<number, TTreeNodeWithChildren>();
    const roots: TTreeNodeWithChildren[] = [];

    flatData.forEach((node) => {
        const key =
            node.type === ETreeNodeType.CATEGORY ? node.id : node.post_id!;
        map.set(key, { ...node, children: [] });
    });

    flatData.forEach((node) => {
        const key =
            node.type === ETreeNodeType.CATEGORY ? node.id : node.post_id!;
        const current = map.get(key)!;

        if (node.parent_id === null) {
            roots.push(current);
        } else {
            const parent = map.get(node.parent_id);
            if (parent) {
                parent.children!.push(current);
            }
        }
    });

    return roots;
};

export const isCategoryNode = (node: TTreeNode): node is TCategoryTreeNode => {
    return node.type === ETreeNodeType.CATEGORY;
};

export const isPostNode = (node: TTreeNode): node is TPostTreeNode => {
    return node.type === ETreeNodeType.POST;
};
