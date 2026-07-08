// utils/backtest/engine-output.ts
// Purpose: degenerate-result builder, manual-flow snapper, and post-walk
//          output assembly extracted from engine.ts (LOC SRP split).
// Invariant: pure — no I/O, no side effects, deterministic.

import type {
    BacktestInput,
    BacktestResult,
    DividendEvent,
    Holding,
    PerHoldingResult,
    PricePoint,
    RebalanceState,
} from '@/types/backtest';
import {
    computeCagr,
    computeMaxDrawdown,
    computeDailyReturnsWithFlows,
    computeLogReturnsWithFlows,
    computeVolatility,
    computeSharpe,
    computeXirr,
} from './metrics';
import { buildProjection } from './projection';

// ── Empty result (degenerate input) ──────────────────────────────────────────

export function buildEmptyResult(budget: number): BacktestResult {
    return {
        timeline: [],
        metrics: {
            finalValue: budget,
            totalReturnPct: 0,
            cagr: 0,
            maxDrawdown: 0,
            volatility: 0,
            sharpe: null,
            cumulativeDividends: 0,
            totalContributed: budget,
            moneyWeightedReturn: null,
        },
        perHolding: [],
        dividends: { byLabel: {}, total: 0, schedule: [] },
        projection: {
            cagrCurve: [],
            monteCarlo: [],
            income: {
                annualYieldPct: 0,
                projectedAnnualCash: 0,
                projectedMonthlyCash: 0,
            },
        },
    };
}

// ── Manual-flow date snapping (X2.18) ─────────────────────────────────────────

/**
 * Snap each manual-flow date to the first trading day >= that date.
 * Duplicate snapped dates: amounts are summed (net flow on that day).
 * Flows that would snap past globalTo are dropped.
 */
export function buildManualFlowMap(
    manualFlows: { date: string; amount: number }[] | undefined,
    sortedDates: string[]
): Map<string, number> {
    if (!manualFlows || manualFlows.length === 0) return new Map();

    // Binary search: first trading day >= target
    const snap = (target: string): string | null => {
        let lo = 0;
        let hi = sortedDates.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const d = sortedDates[mid] ?? '';
            if (d < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return sortedDates[lo] ?? null;
    };

    const result = new Map<string, number>();
    for (const { date, amount } of manualFlows) {
        const snapped = snap(date);
        if (snapped === null) continue;
        result.set(snapped, (result.get(snapped) ?? 0) + amount);
    }
    return result;
}

// ── Post-walk output assembly ─────────────────────────────────────────────────

export interface AssembleParams {
    budget: number;
    timeline: { date: string; value: number }[];
    perHoldingValuesSeries: { date: string; values: Record<string, number> }[];
    perAssetPurchases: { date: string; buys: Record<string, number> }[];
    sortedDates: string[];
    flowsByDate: Map<string, number>;
    holdings: Holding[];
    dateIndexes: Map<string, Map<string, PricePoint>>;
    globalTo: string;
    shares: Map<string, number>;
    initialAlloc: Map<string, number>;
    dividendsByLabel: Map<string, number>;
    dividendSchedule: DividendEvent[];
    xirrFlows: { date: string; amount: number }[];
    totalContributed: number;
    contribution: BacktestInput['contribution'];
    manualFlows: BacktestInput['manualFlows'];
    rebalPolicy: BacktestInput['rebalance'];
    rebalState: RebalanceState;
    riskFreeRate: number;
    seed: number;
}

/**
 * Assemble the final BacktestResult from post-walk data.
 * NOTE: mutates xirrFlows (appends terminal cash flow) — caller must not
 * reuse that array after calling this function.
 */
export function assembleBacktestResult(p: AssembleParams): BacktestResult {
    const portfolioValues = p.timeline.map((t) => t.value);
    const vStart = portfolioValues[0] ?? p.budget;
    const vEnd = portfolioValues[portfolioValues.length - 1] ?? p.budget;
    const years = Math.max(p.sortedDates.length / 252, 1 / 365);

    const cagrValue = computeCagr(vStart, vEnd, years);
    const mdd = computeMaxDrawdown(portfolioValues);

    const flowsArray = p.sortedDates.map((d) => p.flowsByDate.get(d) ?? 0);
    const flowCorrectedReturns = computeDailyReturnsWithFlows(
        portfolioValues,
        flowsArray
    );
    const flowCorrectedLogReturns = computeLogReturnsWithFlows(
        portfolioValues,
        flowsArray
    );
    const vol = computeVolatility(flowCorrectedReturns);
    const sharpeValue = computeSharpe(cagrValue, vol, p.riskFreeRate);
    const totalDividends = Array.from(p.dividendsByLabel.values()).reduce(
        (a, b) => a + b,
        0
    );

    const moneyWeightedReturn = (() => {
        if (!p.contribution && (!p.manualFlows || p.manualFlows.length === 0))
            return null;
        p.xirrFlows.push({ date: p.globalTo, amount: vEnd });
        return computeXirr(p.xirrFlows);
    })();

    const totalReturnPct =
        p.totalContributed > 0
            ? (vEnd - p.totalContributed) / p.totalContributed
            : 0;

    const perHolding: PerHoldingResult[] = p.holdings.map((h) => {
        const bar = p.dateIndexes.get(h.label)?.get(p.globalTo);
        const finalShares = p.shares.get(h.label) ?? 0;
        const finalVal = bar ? finalShares * bar.close : 0;
        const initVal = p.initialAlloc.get(h.label) ?? 0;
        return {
            label: h.label,
            shares: finalShares,
            finalValue: finalVal,
            totalReturnPct: initVal > 0 ? (finalVal - initVal) / initVal : 0,
            dividendsReceived: p.dividendsByLabel.get(h.label) ?? 0,
        };
    });

    const projection = buildProjection({
        vEnd,
        cagrValue,
        logReturns: flowCorrectedLogReturns,
        cumulativeDividends: totalDividends,
        capitalBase: p.totalContributed,
        years,
        endDate: p.globalTo,
        seed: p.seed,
    });

    const flowsByDateRecord: Record<string, number> | undefined =
        p.flowsByDate.size > 0 ? Object.fromEntries(p.flowsByDate) : undefined;

    const rebalanceResult = p.rebalPolicy
        ? {
              events: p.rebalState.events,
              warnings: p.rebalState.warnings,
          }
        : undefined;

    return {
        timeline: p.timeline,
        metrics: {
            finalValue: vEnd,
            totalReturnPct,
            cagr: cagrValue,
            maxDrawdown: mdd,
            volatility: vol,
            sharpe: sharpeValue,
            cumulativeDividends: totalDividends,
            totalContributed: p.totalContributed,
            moneyWeightedReturn,
        },
        perHolding,
        dividends: {
            byLabel: Object.fromEntries(p.dividendsByLabel),
            total: totalDividends,
            schedule: p.dividendSchedule,
        },
        projection,
        flowsByDate: flowsByDateRecord,
        rebalance: rebalanceResult,
        perHoldingValues: p.perHoldingValuesSeries,
        perAssetPurchases: p.perAssetPurchases,
    };
}
