// hooks/useCreateCategory.query.client.ts
// Purpose: TanStack mutation that creates/resurrects a category, then seeds the
// new node into the ['categoryTree', username] cache and invalidates it so the
// cascader can select it immediately (no refetch round-trip required first).
// Constraints: client-only; requires a Clerk token. Category ids stay STRINGS.

'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '@/apis/createCategory.api';
import { categoryTreeQueryKey } from '@/hooks/useCategoryTree.query.client';
import { normalizeId, type TCategoryItem } from '@/utils/categoryPath';
import type { TCategoryNode, TCreateCategoryInput } from '@repo/types';

export function useCreateCategory(username: string | null | undefined) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const key = categoryTreeQueryKey(username);

    return useMutation<TCategoryNode, Error, TCreateCategoryInput>({
        mutationFn: async (input) => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return createCategory(token, input);
        },
        onSuccess: (node) => {
            queryClient.setQueryData<TCategoryItem[]>(key, (prev) => {
                const item: TCategoryItem = {
                    id: normalizeId(node.id),
                    parentId:
                        node.parentId == null
                            ? null
                            : normalizeId(node.parentId),
                    title: node.title,
                };
                const existing = prev ?? [];
                if (existing.some((n) => n.id === item.id)) return existing;
                return [...existing, item];
            });
            void queryClient.invalidateQueries({ queryKey: key });
        },
    });
}
