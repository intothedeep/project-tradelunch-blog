// utils/rankFlowRows.ts
// Purpose: client-side helpers for rendering the rank-flow grid.
//   The union/ranking is computed by the Express endpoint; this module handles
//   display-level concerns: quarter ordering, safe cell lookup, column ordering,
//   and row ordering for aligned-reference mode.
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

/**
 * Returns the rows that are held in `period`, sorted by that period's rank asc.
 * Used by flow-mode to stack securities top→bottom by rank within a column.
 * Rows not held in `period` are excluded entirely.
 */
export function orderColumnByRank(
    rows: RankFlowRow[],
    period: string
): RankFlowRow[] {
    return rows
        .filter((r) => r.cells[period] != null)
        .sort((a, b) => {
            const rankA = (a.cells[period] as RankFlowCell).rank;
            const rankB = (b.cells[period] as RankFlowCell).rank;
            return rankA - rankB;
        });
}

/**
 * Returns the best (lowest) rank a row achieves across all periods.
 * Returns Infinity for rows with no held cells (all null).
 */
function bestRank(row: RankFlowRow): number {
    let best = Infinity;
    for (const cell of Object.values(row.cells)) {
        if (cell != null && cell.rank < best) {
            best = cell.rank;
        }
    }
    return best;
}

/**
 * Sorts all rows for the aligned-reference mode.
 * Primary sort: rank in `refPeriod` asc (held securities first).
 * Rows not held in `refPeriod` are pushed to the bottom, sorted by:
 *   1. Best rank across all periods asc (most significant unheld rows first).
 *   2. cusip lexicographic (stable tie-break).
 */
export function sortRowsByReference(
    rows: RankFlowRow[],
    refPeriod: string
): RankFlowRow[] {
    const held: RankFlowRow[] = [];
    const unheld: RankFlowRow[] = [];

    for (const row of rows) {
        if (row.cells[refPeriod] != null) {
            held.push(row);
        } else {
            unheld.push(row);
        }
    }

    held.sort((a, b) => {
        const rankA = (a.cells[refPeriod] as RankFlowCell).rank;
        const rankB = (b.cells[refPeriod] as RankFlowCell).rank;
        return rankA - rankB;
    });

    unheld.sort((a, b) => {
        const bestA = bestRank(a);
        const bestB = bestRank(b);
        if (bestA !== bestB) return bestA - bestB;
        return a.cusip.localeCompare(b.cusip);
    });

    return [...held, ...unheld];
}
