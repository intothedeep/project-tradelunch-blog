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
