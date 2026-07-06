// utils/backtest/rebalance-schedule.ts
// Purpose: determine whether a rebalance is due on a given bar (X2.4).
// Invariant: pure — no I/O, no side effects, works on 'YYYY-MM-DD' string slices only.

import type { RebalancePolicy } from '@/types/backtest';

/**
 * Return true if a rebalance should be triggered on `barDate` given `freq`
 * and the last rebalance date.
 *
 * Boundary logic (matches contributions.ts style — string slices, no Date math):
 *   never     → always false
 *   bar       → always true
 *   monthly   → true on the first bar of a new calendar month vs prevRebalanceDate
 *   quarterly → true on the first bar of a new calendar quarter (Jan/Apr/Jul/Oct)
 *   yearly    → true on the first bar of a new calendar year
 *
 * When prevRebalanceDate is null (first bar ever) → always true (except never).
 */
export function isRebalanceDue(
    freq: RebalancePolicy['freq'],
    prevRebalanceDate: string | null,
    barDate: string
): boolean {
    if (freq === 'never') return false;
    if (freq === 'bar') return true;

    // First-ever bar: trigger for all scheduled frequencies.
    if (prevRebalanceDate === null) return true;

    // Slice 'YYYY-MM-DD' → 'YYYY', 'MM', etc. (no Date construction needed).
    const prevYear = prevRebalanceDate.slice(0, 4);
    const prevMonth = prevRebalanceDate.slice(5, 7);

    const curYear = barDate.slice(0, 4);
    const curMonth = barDate.slice(5, 7);

    if (freq === 'yearly') {
        return curYear !== prevYear;
    }

    if (freq === 'monthly') {
        return curYear !== prevYear || curMonth !== prevMonth;
    }

    if (freq === 'quarterly') {
        const prevQ = monthToQuarter(prevMonth);
        const curQ = monthToQuarter(curMonth);
        return curYear !== prevYear || curQ !== prevQ;
    }

    // Exhaustive — TypeScript union is closed.
    return false;
}

/** Map 2-digit month string to quarter number 1–4. */
function monthToQuarter(mm: string): number {
    const m = parseInt(mm, 10);
    return Math.ceil(m / 3);
}
