// utils/backtest/rebalance-gate.ts
// Purpose: pure helpers for the schedule-coupled threshold gate (R1/R2 extension).
// Invariant: pure — no I/O, no Date, no Math.random().

import type {
    Holding,
    PricePoint,
    ScheduleGateCondition,
} from '@/types/backtest';

/**
 * Compute per-label portfolio weight as PERCENT (0–100).
 * Mirrors computePortfolioSnapshot in rebalance.ts: value = shares × close.
 * Labels with no bar on `date` contribute 0 to their value.
 * If totalNav <= 0, all weights are 0.
 */
export function computeWeights(
    shares: Map<string, number>,
    cash: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    date: string
): Map<string, number> {
    let totalNav = cash;
    const values = new Map<string, number>();

    for (const h of holdings) {
        const bar = dateIndexes.get(h.label)?.get(date);
        const qty = shares.get(h.label) ?? 0;
        const val = bar && bar.close > 0 ? qty * bar.close : 0;
        values.set(h.label, val);
        totalNav += val;
    }

    const weights = new Map<string, number>();
    for (const h of holdings) {
        const val = values.get(h.label) ?? 0;
        weights.set(h.label, totalNav > 0 ? (val / totalNav) * 100 : 0);
    }
    return weights;
}

/**
 * OR semantics: returns true if ANY condition holds.
 * For each condition: w = weightsPct.get(label) ?? 0;
 *   '>=' → w >= pct
 *   '<=' → w <= pct
 */
export function isGateConditionMet(
    conditions: ScheduleGateCondition[],
    weightsPct: Map<string, number>
): boolean {
    for (const cond of conditions) {
        const w = weightsPct.get(cond.label) ?? 0;
        if (cond.dir === '>=' && w >= cond.pct) return true;
        if (cond.dir === '<=' && w <= cond.pct) return true;
    }
    return false;
}
