// utils/rankFlowRows.ts
// Purpose: client-side helpers for rendering the rank-flow grid.
//   The union/ranking is computed by the Express endpoint; this module handles
//   display-level concerns: quarter ordering, safe cell lookup.
// Invariant: pure functions — deterministic, no mutation, no hidden state.
// Side effects: none.

import { sortPeriodsNewestFirst } from '@/utils/quarterLabel';
import type { RankFlowCell, RankFlowRow } from '@/types/rankFlow';

/**
 * Returns the ordered list of period strings (newest-first) from
 * the periods array, capped to `maxQuarters`.
 */
export function getOrderedPeriods(
    periods: { periodOfReport: string }[],
    maxQuarters = 8
): string[] {
    const raw = periods.map((p) => p.periodOfReport);
    return sortPeriodsNewestFirst(raw).slice(0, maxQuarters);
}

/**
 * Returns the cell data for a given row + period, or null if absent/not held.
 */
export function getCell(row: RankFlowRow, period: string): RankFlowCell | null {
    return row.cells[period] ?? null;
}
