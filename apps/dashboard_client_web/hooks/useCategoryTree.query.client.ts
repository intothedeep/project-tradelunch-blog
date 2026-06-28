// hooks/useCategoryTree.query.client.ts
// Purpose: fetch an author's category tree (the public username route) and return
// it as a flat list of normalized {id, parentId, title} string nodes — POST nodes
// filtered out — for the editor cascader.
// Constraints: client-only; disabled until a username is known. Read-only; the
// create mutation seeds/invalidates this same cache key.

'use client';

import { useQuery } from '@tanstack/react-query';
import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { ETreeNodeType } from '@repo/types';
import { normalizeId, type TCategoryItem } from '@/utils/categoryPath';

export const categoryTreeQueryKey = (username: string | null | undefined) =>
    ['categoryTree', username] as const;

export function useCategoryTree(username: string | null | undefined) {
    return useQuery<TCategoryItem[]>({
        queryKey: categoryTreeQueryKey(username),
        queryFn: async () => {
            if (!username) return [];
            const { categories } = await getCategoriesByUsername(username);
            return categories
                .filter((node) => node.type === ETreeNodeType.CATEGORY)
                .map((node) => ({
                    id: normalizeId(node.id),
                    parentId:
                        node.parent_id == null
                            ? null
                            : normalizeId(node.parent_id),
                    title: node.title,
                }));
        },
        enabled: !!username,
    });
}
