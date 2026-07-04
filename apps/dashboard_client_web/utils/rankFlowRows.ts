// utils/rankFlowRows.ts
// Purpose: client-side helpers for rendering rank-flow grids.
//   The union/ranking is computed by the Express endpoint; this module handles
//   display-level concerns: period ordering, safe cell lookup, column ordering,
//   row sorting for aligned-reference mode, and period label formatting.
// Invariant: pure functions — deterministic, no mutation, no hidden state.
// Side effects: none.

import { sortPeriodsNewestFirst } from '@/utils/quarterLabel';
import type { RankFlowCell, RankFlowRow } from '@/types/rankFlow';

// ---------------------------------------------------------------------------
// Period ordering (shared by funds and rankings flow)
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of period strings (newest-first) from
 * the periods array, capped to `maxPeriods`.
 */
export function getOrderedPeriods(
    periods: { periodOfReport: string }[],
    maxPeriods = 8
): string[] {
    const raw = periods.map((p) => p.periodOfReport);
    return sortPeriodsNewestFirst(raw).slice(0, maxPeriods);
}

/**
 * Returns the ordered list of asOf strings (newest-first) from a rankings
 * flow periods array, capped to `maxPeriods`.
 */
export function getOrderedAsOfs(
    periods: { asOf: string }[],
    maxPeriods = 26
): string[] {
    const raw = periods.map((p) => p.asOf);
    return sortPeriodsNewestFirst(raw).slice(0, maxPeriods);
}

// ---------------------------------------------------------------------------
// Cell lookup (funds-keyed)
// ---------------------------------------------------------------------------

/**
 * Returns the cell data for a given row + period, or null if absent/not held.
 */
export function getCell(row: RankFlowRow, period: string): RankFlowCell | null {
    return row.cells[period] ?? null;
}

// ---------------------------------------------------------------------------
// Column ordering (funds-keyed)
// ---------------------------------------------------------------------------

/**
 * Returns the rows that are held in `period`, sorted by that period's rank asc.
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

// ---------------------------------------------------------------------------
// Row sorting for aligned mode (funds-keyed)
// ---------------------------------------------------------------------------

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
 * Sorts all rows for the aligned-reference mode (funds / CUSIP-keyed).
 * Primary sort: rank in `refPeriod` asc (held securities first).
 * Rows not held in `refPeriod` are pushed to the bottom, sorted by:
 *   1. Best rank across all periods asc.
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

// ---------------------------------------------------------------------------
// Generic helpers for symbol-keyed (rankings) flow rows
// ---------------------------------------------------------------------------

/** Minimal cell shape required for generic ordering. */
interface HasRank {
    rank: number;
}

/** Minimal row shape required for generic column ordering. */
type GenericFlowRow = { cells: Record<string, HasRank | null> };

/**
 * Generic column ordering — works with any row type that has a `cells` map.
 * Rows not held in `period` are excluded.
 */
export function orderFlowColumnByRank<R extends GenericFlowRow>(
    rows: R[],
    period: string
): R[] {
    return rows
        .filter((r) => r.cells[period] != null)
        .sort((a, b) => {
            const rankA = (a.cells[period] as HasRank).rank;
            const rankB = (b.cells[period] as HasRank).rank;
            return rankA - rankB;
        });
}

/**
 * Generic best-rank helper for symbol-keyed flow rows.
 */
function bestFlowRank(cells: Record<string, HasRank | null>): number {
    let best = Infinity;
    for (const cell of Object.values(cells)) {
        if (cell !== null && cell.rank < best) best = cell.rank;
    }
    return best;
}

/**
 * Generic aligned-reference sort for symbol-keyed (or any string-key) flow rows.
 * tieBreak: stable secondary sort for unheld rows (e.g. symbol or cusip).
 */
export function sortFlowRowsByRef<R extends GenericFlowRow>(
    rows: R[],
    refPeriod: string,
    tieBreak: (a: R, b: R) => number
): R[] {
    const held: R[] = [];
    const unheld: R[] = [];

    for (const row of rows) {
        if (row.cells[refPeriod] != null) held.push(row);
        else unheld.push(row);
    }

    held.sort((a, b) => {
        const rankA = (a.cells[refPeriod] as HasRank).rank;
        const rankB = (b.cells[refPeriod] as HasRank).rank;
        return rankA - rankB;
    });

    unheld.sort((a, b) => {
        const bestA = bestFlowRank(a.cells);
        const bestB = bestFlowRank(b.cells);
        if (bestA !== bestB) return bestA - bestB;
        return tieBreak(a, b);
    });

    return [...held, ...unheld];
}

// ---------------------------------------------------------------------------
// Period label formatting
// ---------------------------------------------------------------------------

const MONTH_ABBR: Record<string, string> = {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'May',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Aug',
    '09': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec',
};

const MONTH_TO_QUARTER: Record<string, string> = {
    '01': 'Q1',
    '02': 'Q1',
    '03': 'Q1',
    '04': 'Q2',
    '05': 'Q2',
    '06': 'Q2',
    '07': 'Q3',
    '08': 'Q3',
    '09': 'Q3',
    '10': 'Q4',
    '11': 'Q4',
    '12': 'Q4',
};

/**
 * Human-readable period label for a rankings flow column header.
 * @param asOf        'YYYY-MM-DD' — the sampled period date
 * @param granularity 'week' | 'month' | 'quarter' | 'year'
 */
export function periodLabel(asOf: string, granularity: string): string {
    const [year = '', month = '', day = ''] = asOf.split('-');
    const yr2 = year.slice(2);
    const abbr = MONTH_ABBR[month] ?? month;
    switch (granularity) {
        case 'week':
            return `${abbr} ${parseInt(day, 10)} '${yr2}`;
        case 'month':
            return `${abbr} '${yr2}`;
        case 'quarter':
            return `${year} ${MONTH_TO_QUARTER[month] ?? 'Q?'}`;
        case 'year':
            return year;
        default:
            return asOf;
    }
}
