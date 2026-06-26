import { TTreeNode } from '@repo/types';

// Distributive omit so the TTreeNode discriminated union is preserved.
// A plain Omit over a union collapses the `type` discriminant, which breaks
// assignability back to TTreeNodeWithChildren.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never;

// Fully-built tree node: children and postCount are always populated
// (unlike TTreeNodeWithChildren where both are optional).
export type TreeNode = DistributiveOmit<TTreeNode, 'children' | 'postCount'> & {
    children: TreeNode[];
    postCount: number;
};
