import { TTreeNodeWithChildren } from '@repo/types';

export type TreeNode = Omit<TTreeNodeWithChildren, 'children' | 'postCount'> & {
    children: TreeNode[];
    postCount: number;
};
