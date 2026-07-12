// utils/commentTree.util.ts
// Purpose: PURE render helpers for the flat pre-order comment array (Option C).
//   The list is already in tree order (sorted by the server's materialized
//   path), so rendering is a single walk. These helpers compute render-collapse
//   beyond N visible indent levels (Reddit/HN pattern) WITHOUT mutating data —
//   storage stays unlimited; only the indent is clamped.
// Constraints: deterministic, no side effects. Indentation depth is clamped to
//   maxDepth; a node deeper than maxDepth is hidden unless one of its ancestors
//   at exactly maxDepth-1 is in the `expanded` set ("continue thread").

import type { TComment } from '@repo/types';

// Re-order a flat comment list so that, at EVERY level, siblings are newest-first
// (descending) while the tree/pre-order is preserved (a parent still immediately
// precedes its own subtree). The server returns roots newest-first but replies
// oldest-first (ORDER BY path); this rebuilds the tree, sorts each sibling group
// desc, and re-flattens via pre-order DFS.
//   * Sort key: createdAt desc, tie-broken by id desc (STRING compare — never
//     BigInt, so an optimistic temp id like "temp-…" can't throw).
//   * Orphan-safe: a comment whose parent isn't in the list (not loaded) is
//     treated as a root so it is never dropped.
export function rebuildDescendingOrder(list: TComment[]): TComment[] {
    const ROOT = '';
    const ids = new Set(list.map((c) => c.id));
    const childrenOf = new Map<string, TComment[]>();
    for (const c of list) {
        const key = c.parentId && ids.has(c.parentId) ? c.parentId : ROOT;
        const group = childrenOf.get(key) ?? [];
        group.push(c);
        childrenOf.set(key, group);
    }
    for (const group of childrenOf.values()) {
        group.sort((a, b) => {
            const ta = new Date(a.createdAt).getTime();
            const tb = new Date(b.createdAt).getTime();
            if (tb !== ta) return tb - ta; // newest-first
            return a.id < b.id ? 1 : a.id > b.id ? -1 : 0; // id desc, string-safe
        });
    }
    const result: TComment[] = [];
    const visit = (key: string) => {
        for (const c of childrenOf.get(key) ?? []) {
            result.push(c);
            visit(c.id);
        }
    };
    visit(ROOT);
    return result;
}

export interface TRenderRow {
    comment: TComment;
    // Indentation level clamped to [0, maxDepth] for layout.
    indent: number;
    // True when this row is the deepest VISIBLE ancestor of a hidden subtree —
    // it shows the "continue thread →" affordance.
    hasHiddenChildren: boolean;
}

// Does `list[i]` have at least one direct/indirect child in the array?
function hasChildAfter(list: TComment[], index: number): boolean {
    const next = list[index + 1];
    return next !== undefined && next.depth > list[index]!.depth;
}

// Walk the flat pre-order array and emit only the rows that should be VISIBLE
// given the render-collapse threshold and the set of expanded ancestor ids.
// A node at depth >= maxDepth is hidden unless its ancestor at depth maxDepth-1
// is expanded. The clamping ancestor row carries hasHiddenChildren so the UI can
// render a "continue thread →" toggle.
export function buildRenderRows(
    list: TComment[],
    maxDepth: number,
    expanded: ReadonlySet<string>
): TRenderRow[] {
    const rows: TRenderRow[] = [];
    // The path prefix at the clamp boundary (depth maxDepth-1) currently being
    // skipped because it is collapsed; null when not skipping.
    let collapsedUnderId: string | null = null;
    let collapsedDepth = 0;

    for (let i = 0; i < list.length; i++) {
        const comment = list[i]!;

        // Leaving a collapsed subtree once we return to its depth or shallower.
        if (collapsedUnderId !== null && comment.depth <= collapsedDepth) {
            collapsedUnderId = null;
        }
        if (collapsedUnderId !== null) {
            continue; // hidden descendant of a collapsed boundary node
        }

        const boundary = maxDepth - 1;
        const isBoundary = comment.depth === boundary;
        const hidesChildren =
            isBoundary && hasChildAfter(list, i) && !expanded.has(comment.id);

        if (hidesChildren) {
            collapsedUnderId = comment.id;
            collapsedDepth = comment.depth;
        }

        rows.push({
            comment,
            indent: Math.min(comment.depth, maxDepth - 1),
            hasHiddenChildren: hidesChildren,
        });
    }

    return rows;
}
