// utils/backtest/contributions.ts
// Purpose: generate DCA contribution dates snapped to actual trading days (pure).
// Invariant: deterministic, no I/O, no side effects, no Date.now().
// Note: noUncheckedIndexedAccess is enabled — all array access uses for-of or
//       explicit undefined guards.

import { addMonths, addYears } from './dateAdd';
import type { ContributionFreq } from '@/types/backtest';

/**
 * Binary search: first index in sortedDates where sortedDates[idx] >= target.
 * Returns null if no such index exists (target > all dates).
 */
function firstTradingDayGe(
    sortedDates: string[],
    target: string
): string | null {
    let lo = 0;
    let hi = sortedDates.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const midDate = sortedDates[mid] ?? '';
        if (midDate < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return sortedDates[lo] ?? null;
}

/**
 * Build sorted contribution dates for DCA.
 *
 * Each nominal date (globalFrom + n × period) is snapped to the FIRST
 * actual trading day >= that nominal — no look-ahead (never previous day).
 * Nominals after globalTo are dropped. Duplicate snapped dates are deduped.
 *
 * @param sortedDates  All trading dates in the backtest window, sorted ascending.
 * @param globalFrom   First trading date in the window.
 * @param globalTo     Last trading date in the window.
 * @param freq         'monthly' | 'yearly'
 * @param includeStart When true the first nominal equals globalFrom (pure-DCA,
 *                     budget=0). When false the first nominal is globalFrom + 1
 *                     period (lump-sum + DCA — avoids double-investing on day 0).
 */
export function buildContributionDates(
    sortedDates: string[],
    globalFrom: string,
    globalTo: string,
    freq: ContributionFreq,
    includeStart: boolean
): string[] {
    const advance = (d: string) =>
        freq === 'monthly' ? addMonths(d, 1) : addYears(d, 1);

    // First nominal date
    const firstNominal = includeStart ? globalFrom : advance(globalFrom);

    const result: string[] = [];
    const seen = new Set<string>();

    let nominal = firstNominal;
    while (nominal <= globalTo) {
        const snapped = firstTradingDayGe(sortedDates, nominal);
        if (snapped !== null && snapped <= globalTo && !seen.has(snapped)) {
            seen.add(snapped);
            result.push(snapped);
        }
        nominal = advance(nominal);
    }

    return result;
}
