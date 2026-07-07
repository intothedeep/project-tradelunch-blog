// utils/backtest/yearlyStats.ts
// Purpose: pure post-processor building a per-year table of the ROLLING
//   annualised return (inception → each calendar year-end) from a BacktestResult.
// Definition (matches the headline metric so the last row reconciles):
//   - lump-sum (no DCA flows): time-weighted CAGR = (Vend/Vstart)^(1/years) − 1,
//     with years = tradingBars/252 (same convention as engine.metrics.cagr).
//   - DCA (flows present): money-weighted XIRR-to-date over the initial budget
//     (if any) + contributions up to the year-end + the year-end value.
// Invariant: pure — no I/O, no Date.now(); string-slice year bucketing.

import type { BacktestResult } from '@/types/backtest';
import { computeCagr, computeXirr } from './metrics';

export interface YearlyStatRow {
    year: string; // 'YYYY'
    endDate: string; // last trading bar in that year 'YYYY-MM-DD'
    endValue: number;
    /** Rolling annualised return to this year-end. null when undefined (e.g. XIRR with no root). */
    annualizedReturnPct: number | null;
}

/**
 * Build the rolling-annualised yearly table.
 * @param result - engine output (uses timeline + flowsByDate).
 * @param budget - initial lump-sum (needed to reconstruct the XIRR outflow in DCA mode).
 */
export function buildYearlyStats(
    result: BacktestResult,
    budget: number
): YearlyStatRow[] {
    const { timeline, flowsByDate } = result;
    if (timeline.length === 0) return [];

    const startDate = timeline[0]!.date;
    const startValue = timeline[0]!.value;
    const hasDca =
        flowsByDate !== undefined && Object.keys(flowsByDate).length > 0;

    // Year-end = last bar per calendar year; track running trading-bar count so
    // the lump-sum CAGR uses the same years = bars/252 convention as the engine.
    const yearEnd = new Map<
        string,
        { date: string; value: number; bars: number }
    >();
    let bars = 0;
    for (const bar of timeline) {
        bars++;
        yearEnd.set(bar.date.slice(0, 4), {
            date: bar.date,
            value: bar.value,
            bars,
        });
    }

    // DCA contribution flows as investor outflows (negative), date-ascending.
    const contribFlows = hasDca
        ? Object.entries(flowsByDate!)
              .map(([date, amount]) => ({ date, amount: -amount }))
              .sort((a, b) => (a.date < b.date ? -1 : 1))
        : [];

    const rows: YearlyStatRow[] = [];
    for (const [year, { date: endDate, value: endValue, bars: n }] of yearEnd) {
        let annualized: number | null;
        if (hasDca) {
            const flows: { date: string; amount: number }[] = [];
            if (budget > 0) flows.push({ date: startDate, amount: -budget });
            for (const f of contribFlows) {
                if (f.date <= endDate) flows.push(f);
            }
            flows.push({ date: endDate, amount: endValue });
            annualized = computeXirr(flows);
        } else {
            const years = Math.max(n / 252, 1 / 365);
            annualized = computeCagr(startValue, endValue, years);
        }
        rows.push({ year, endDate, endValue, annualizedReturnPct: annualized });
    }
    return rows;
}
