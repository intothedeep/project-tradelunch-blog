// components/write/CategoryCascader.client.tsx
// Purpose: progressive depth-1..3 category cascade (Layout A) — box2 appears only
// after box1 is chosen, box3 after box2, laid out inline (wraps on small screens).
// The single stored value is the DEEPEST selected node (leaf) id; the visible path
// is rebuilt from it via buildPath, each box's options = the prior selection's
// children. Hard-capped at 3 boxes.
// Constraints: client-only, controlled (value = leaf id | null). Tree data comes
// from useCategoryTree; create flows through each box's useCreateCategory.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CategoryComboBox } from '@/components/write/CategoryComboBox.client';
import { useCategoryTree } from '@/hooks/useCategoryTree.query.client';
import { buildPath, normalizeId, selectChildren } from '@/utils/categoryPath';
import type { TCategoryNode } from '@repo/types';

const MAX_DEPTH = 3;

interface CategoryCascaderProps {
    username: string | null | undefined;
    value: string | null;
    onChange: (id: string | null) => void;
}

export function CategoryCascader({
    username,
    value,
    onChange,
}: CategoryCascaderProps) {
    const t = useTranslations('write');
    const { data: nodes = [] } = useCategoryTree(username);
    // Depth whose box should auto-open after a "+ Add" (focus advance). Reset on
    // any plain selection so an opened box does not re-trigger on later renders.
    const [openDepth, setOpenDepth] = useState<number | null>(null);

    // Ordered root→leaf chain for the current leaf; drives which boxes render.
    const path = buildPath(nodes, value);
    const labels = [
        t('category.label'),
        t('category.labelSub'),
        t('category.labelSubSub'),
    ];

    // Always one box past the deepest selection (to drill deeper / add), capped.
    const visibleCount = Math.min(path.length + 1, MAX_DEPTH);

    const boxes = [];
    for (let depth = 0; depth < visibleCount; depth += 1) {
        const parentId = depth === 0 ? null : path[depth - 1]!.id;
        const selectedId = path[depth]?.id ?? null;
        const options = selectChildren(nodes, parentId);
        boxes.push(
            <CategoryComboBox
                key={depth}
                label={labels[depth] ?? labels[labels.length - 1]!}
                username={username}
                parentId={parentId}
                options={options}
                value={selectedId}
                autoOpen={openDepth === depth}
                onSelect={(id) => {
                    // Pick a node → it becomes the leaf (deeper boxes drop);
                    // "— none" → fall back to this box's parent (null at box1).
                    onChange(id ?? parentId);
                    setOpenDepth(null);
                }}
                onCreated={(node: TCategoryNode) => {
                    onChange(normalizeId(node.id));
                    setOpenDepth(depth + 1 < MAX_DEPTH ? depth + 1 : null);
                }}
            />
        );
    }

    return <div className="flex flex-wrap gap-2">{boxes}</div>;
}
