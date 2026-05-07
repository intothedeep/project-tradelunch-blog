import { TTreeNodeWithChildren } from '@repo/markdown-parsing/types';

export type TreeNode = Omit<TTreeNodeWithChildren, 'children' | 'postCount'> & {
    children: TreeNode[];
    postCount: number;
};
