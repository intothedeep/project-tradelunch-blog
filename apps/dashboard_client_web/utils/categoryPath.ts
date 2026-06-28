// utils/categoryPath.ts
// Purpose: pure tree helpers for the editor category cascader — normalize ids to
// strings, list a parent's direct children, and rebuild the root→leaf ancestor
// path from a single stored leaf id (posts.category_id) for seeding the cascade.
// Constraints: pure functions only — deterministic input→output, no I/O, no
// hidden state. All id comparisons go through String() (BIGINT/snowflake-safe;
// never Number() a category id).

// Normalized category node used by the cascader UI (camelCase, string ids).
export interface TCategoryItem {
    id: string;
    parentId: string | null;
    title: string;
}

// Coerce any id-ish value to a stable string key.
export const normalizeId = (value: unknown): string => String(value);

// Direct children of `parentId` (null = the roots). Order is preserved.
export function selectChildren(
    nodes: TCategoryItem[],
    parentId: string | null
): TCategoryItem[] {
    const target = parentId == null ? null : normalizeId(parentId);
    return nodes.filter((node) => {
        const nodeParent =
            node.parentId == null ? null : normalizeId(node.parentId);
        return nodeParent === target;
    });
}

// Ordered ancestor chain root→leaf for a leaf id (empty when leafId is null or
// not present). A self-guard stops on any accidental cycle.
export function buildPath(
    nodes: TCategoryItem[],
    leafId: string | null
): TCategoryItem[] {
    if (leafId == null) return [];
    const byId = new Map(nodes.map((node) => [normalizeId(node.id), node]));
    const path: TCategoryItem[] = [];
    const seen = new Set<string>();
    let current = byId.get(normalizeId(leafId));
    while (current && !seen.has(normalizeId(current.id))) {
        seen.add(normalizeId(current.id));
        path.push(current);
        current =
            current.parentId == null
                ? undefined
                : byId.get(normalizeId(current.parentId));
    }
    return path.reverse();
}
