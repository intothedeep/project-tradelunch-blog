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

/** Per-asset month-end weight% (holding MV ÷ total NAV). */
export interface MonthlyAssetWeights {
    /** Asset labels in the order they were emitted by the engine. */
    labels: string[];
    /**
     * weightByMonth['YYYY-MM'][label] = weight fraction 0–1.
     * Only months that appear in perHoldingValues are populated.
     */
    weightByMonth: Record<string, Record<string, number>>;
}

/** Per-asset month-end share count (holding MV ÷ month-end price). */
export interface MonthlyAssetShares {
    /** Asset labels in the order they were emitted by the engine. */
    labels: string[];
    /**
     * sharesByMonth['YYYY-MM'][label] = fractional share count.
     * Only months where price > 0 are populated per asset.
     */
    sharesByMonth: Record<string, Record<string, number>>;
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

// ── X2.17b: per-asset monthly weight% ────────────────────────────────────────

/**
 * Derive per-asset month-end weight% from perHoldingValues.
 *
 * Algorithm:
 *   1. For each bar in perHoldingValues, track the last bar per 'YYYY-MM'.
 *   2. On the month-end bar, weight[label] = values[label] / nav,
 *      where nav = timeline[i].value (total NAV including cash).
 *   3. If nav ≤ 0, all weights are 0 (degenerate edge).
 *
 * - Pure: no I/O, no Date objects, no mutation.
 * - timeline and perHoldingValues must be co-indexed (engine invariant).
 * - Returns empty labels + empty weightByMonth when perHoldingValues is absent.
 */
export function buildMonthlyAssetWeights(
    result: BacktestResult
): MonthlyAssetWeights {
    const { timeline, perHoldingValues } = result;

    if (!perHoldingValues || perHoldingValues.length === 0) {
        return { labels: [], weightByMonth: {} };
    }

    // Derive label order from the first snapshot.
    const labels = Object.keys(perHoldingValues[0]!.values);

    // Single pass: keep the last index per month-key (ascending timeline invariant).
    const monthEndIdx = new Map<string, number>();
    for (let i = 0; i < perHoldingValues.length; i++) {
        const mo = perHoldingValues[i]!.date.slice(0, 7);
        monthEndIdx.set(mo, i);
    }

    const weightByMonth: Record<string, Record<string, number>> = {};

    for (const [month, idx] of monthEndIdx) {
        const snap = perHoldingValues[idx]!;
        const nav = timeline[idx]!.value;
        const monthWeights: Record<string, number> = {};

        if (nav > 0) {
            for (const label of labels) {
                monthWeights[label] = (snap.values[label] ?? 0) / nav;
            }
        } else {
            for (const label of labels) {
                monthWeights[label] = 0;
            }
        }

        weightByMonth[month] = monthWeights;
    }

    return { labels, weightByMonth };
}

// ── X2 Task B: per-asset monthly share count ─────────────────────────────────

/**
 * Derive per-asset month-end share count from perHoldingValues + priceByMonth.
 *
 * Algorithm:
 *   shares = value / price, where value = perHoldingValues[monthEndIdx].values[label]
 *   and price = priceByMonth['YYYY-MM'][label] (split-adjusted month-end close).
 *   When price ≤ 0 or absent, the entry is omitted (guard against divide-by-zero).
 *
 * - Pure: no I/O, no Date objects, no mutation.
 * - Returns empty labels + empty sharesByMonth when perHoldingValues is absent.
 */
export function buildMonthlyAssetShares(
    result: BacktestResult,
    priceByMonth: Record<string, Record<string, number>>
): MonthlyAssetShares {
    const { perHoldingValues } = result;

    if (!perHoldingValues || perHoldingValues.length === 0) {
        return { labels: [], sharesByMonth: {} };
    }

    const labels = Object.keys(perHoldingValues[0]!.values);

    // Single pass: keep the last index per month-key (ascending timeline invariant).
    const monthEndIdx = new Map<string, number>();
    for (let i = 0; i < perHoldingValues.length; i++) {
        const mo = perHoldingValues[i]!.date.slice(0, 7);
        monthEndIdx.set(mo, i);
    }

    const sharesByMonth: Record<string, Record<string, number>> = {};

    for (const [month, idx] of monthEndIdx) {
        const snap = perHoldingValues[idx]!;
        const monthShares: Record<string, number> = {};
        const prices = priceByMonth[month];

        for (const label of labels) {
            const price = prices?.[label];
            const value = snap.values[label] ?? 0;
            if (price !== undefined && price > 0) {
                monthShares[label] = value / price;
            }
        }

        sharesByMonth[month] = monthShares;
    }

    return { labels, sharesByMonth };
}
