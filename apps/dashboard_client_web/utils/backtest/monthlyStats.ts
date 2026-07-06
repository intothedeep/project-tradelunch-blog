// utils/backtest/monthlyStats.ts
// Purpose: pure post-processor that buckets the backtest timeline into
//   calendar-month rows. NO engine modification — only BacktestResult consumed.
// Invariant: deterministic, no I/O, no Date objects (string-slice only to
//   avoid timezone month-boundary shifts).

import type { BacktestResult } from '@/types/backtest';

export interface MonthlyStatRow {
    month: string; // 'YYYY-MM'
    endDate: string; // last trading bar in that month 'YYYY-MM-DD'
    endValue: number;
    monthReturnPct: number; // endValue / prevEndValue - 1 (first row vs start)
    cumulativeReturnPct: number; // endValue / firstValue - 1
    drawdownPct: number; // endValue / runningPeak - 1 (≤ 0)
    dividendCash: number; // sum of schedule.cash in month (DRIP cash:0 excluded)
    cumulativeDividend: number; // running total of dividendCash
    contribution?: number; // present only when flowsByDate given (DCA)
    totalInvestedToDate?: number; // running sum of contributions + budget
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Pre-aggregate dividend cash by 'YYYY-MM'. DRIP events (cash: 0) sum to 0 naturally. */
function buildDivByMonth(
    schedule: BacktestResult['dividends']['schedule']
): Map<string, number> {
    const out = new Map<string, number>();
    for (const ev of schedule) {
        const mo = ev.date.slice(0, 7);
        out.set(mo, (out.get(mo) ?? 0) + ev.cash);
    }
    return out;
}

/** Pre-aggregate contribution flows by 'YYYY-MM'. */
function buildFlowByMonth(
    flowsByDate: Record<string, number>
): Map<string, number> {
    const out = new Map<string, number>();
    for (const [date, amount] of Object.entries(flowsByDate)) {
        const mo = date.slice(0, 7);
        out.set(mo, (out.get(mo) ?? 0) + amount);
    }
    return out;
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Build a month-by-month statistics table from a BacktestResult.
 * - Uses string slicing for month bucketing (no Date objects → no TZ shifts).
 * - timeline must be date-ascending (engine invariant).
 * - When flowsByDate is absent, contribution/totalInvestedToDate are omitted.
 */
export function buildMonthlyStats(
    result: BacktestResult,
    flowsByDate?: Record<string, number>
): MonthlyStatRow[] {
    const { timeline, dividends, metrics } = result;
    if (timeline.length === 0) return [];

    // Pre-aggregate dividends and flows by month.
    const divByMonth = buildDivByMonth(dividends.schedule);
    const hasDca =
        flowsByDate !== undefined && Object.keys(flowsByDate).length > 0;
    const flowByMonth = hasDca
        ? buildFlowByMonth(flowsByDate!)
        : new Map<string, number>();

    // Single pass: collect last bar per month-key (timeline is ascending).
    // Map preserves insertion order → rows will be chronologically ascending.
    const monthEndMap = new Map<string, { date: string; value: number }>();
    for (const bar of timeline) {
        const mo = bar.date.slice(0, 7);
        monthEndMap.set(mo, { date: bar.date, value: bar.value });
    }

    // Single pass over sorted month-end entries to compute running metrics.
    const firstValue = timeline[0]!.value;
    let runningPeak = firstValue;
    let prevEndValue = firstValue;
    let cumulativeDividend = 0;
    // totalInvested starts at budget (initial lump-sum); DCA adds on top.
    // We track it as a running sum of monthly contributions only —
    // the initial budget is already reflected in firstValue (the start point).
    // For the cumulativeReturnPct denominator we use firstValue (same as engine).
    let totalInvestedToDate = firstValue; // proxy: budget at t=0

    const rows: MonthlyStatRow[] = [];

    for (const [month, { date: endDate, value: endValue }] of monthEndMap) {
        if (endValue > runningPeak) runningPeak = endValue;

        const monthReturnPct =
            prevEndValue > 0 ? endValue / prevEndValue - 1 : 0;
        const cumulativeReturnPct =
            firstValue > 0 ? endValue / firstValue - 1 : 0;
        const drawdownPct = runningPeak > 0 ? endValue / runningPeak - 1 : 0;
        const dividendCash = divByMonth.get(month) ?? 0;
        cumulativeDividend += dividendCash;

        const row: MonthlyStatRow = {
            month,
            endDate,
            endValue,
            monthReturnPct,
            cumulativeReturnPct,
            drawdownPct,
            dividendCash,
            cumulativeDividend,
        };

        if (hasDca) {
            const contrib = flowByMonth.get(month) ?? 0;
            totalInvestedToDate += contrib;
            row.contribution = contrib;
            row.totalInvestedToDate = totalInvestedToDate;
        }

        rows.push(row);
        prevEndValue = endValue;
    }

    // Sanity: last row's cumulativeReturnPct must match metrics.totalReturnPct.
    // (Checked in tests; no runtime throw — pure post-processing.)
    void metrics; // referenced only in tests

    return rows;
}
