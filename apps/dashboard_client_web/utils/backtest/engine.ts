// utils/backtest/engine.ts
// Purpose: orchestrates the lump-sum buy-and-hold backtest walk (Phase X, X.6).
// Invariant: pure function — deterministic given input; no I/O, no Date.now(),
//            no Math.random(). All side-effects are isolated in callers.
// Note: noUncheckedIndexedAccess is enabled — all array/object access uses
//       explicit undefined guards or for-of patterns.

import type {
    BacktestInput,
    BacktestResult,
    PricePoint,
    PerHoldingResult,
    DividendEvent,
} from '@/types/backtest';
import {
    computeCagr,
    computeMaxDrawdown,
    computeDailyReturns,
    computeLogReturns,
    computeVolatility,
    computeSharpe,
} from './metrics';
import { buildProjection } from './projection';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateIndex(series: PricePoint[]): Map<string, PricePoint> {
    return new Map(series.map((p) => [p.date, p]));
}

// ── Empty result (degenerate input) ──────────────────────────────────────────

function buildEmptyResult(budget: number): BacktestResult {
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

// ── Main engine ───────────────────────────────────────────────────────────────

export function runBacktest(input: BacktestInput): BacktestResult {
    const { budget, holdings, seriesByLabel, range, seed, riskFreeRate } =
        input;

    if (holdings.length === 0 || budget <= 0) return buildEmptyResult(budget);

    // Build date indexes for O(1) lookup during the walk.
    const dateIndexes = new Map<string, Map<string, PricePoint>>();
    for (const label of Object.keys(seriesByLabel)) {
        const series = seriesByLabel[label];
        if (series !== undefined)
            dateIndexes.set(label, buildDateIndex(series));
    }

    // Build the sorted union of all trading dates within the requested range.
    const dateSet = new Set<string>();
    for (const label of Object.keys(seriesByLabel)) {
        const series = seriesByLabel[label];
        if (!series) continue;
        for (const p of series) {
            if (p.date >= range.from && p.date <= range.to) dateSet.add(p.date);
        }
    }
    const sortedDates = Array.from(dateSet).sort();
    if (sortedDates.length === 0) return buildEmptyResult(budget);

    const globalFrom = sortedDates[0] ?? '';
    const globalTo = sortedDates[sortedDates.length - 1] ?? '';
    if (!globalFrom || !globalTo) return buildEmptyResult(budget);

    // Initial lump-sum allocation at globalFrom.
    // If a holding has no bar at globalFrom, its budget stays as residual cash.
    const shares = new Map<string, number>();
    const initialAlloc = new Map<string, number>();
    let cash = 0;

    for (const h of holdings) {
        const allocated = budget * (h.weightPct / 100);
        const idx = dateIndexes.get(h.label);
        const bar = idx?.get(globalFrom);
        if (bar && bar.close > 0) {
            shares.set(h.label, allocated / bar.close);
            initialAlloc.set(h.label, allocated);
        } else {
            shares.set(h.label, 0);
            initialAlloc.set(h.label, 0);
            cash += allocated; // residual: no price available at from date
        }
    }

    // ── Date walk ────────────────────────────────────────────────────────────
    const timeline: { date: string; value: number }[] = [];
    const dividendSchedule: DividendEvent[] = [];
    const dividendsByLabel = new Map<string, number>();
    for (const h of holdings) dividendsByLabel.set(h.label, 0);

    for (const date of sortedDates) {
        for (const h of holdings) {
            const bar = dateIndexes.get(h.label)?.get(date);
            if (!bar) continue;

            const currentShares = shares.get(h.label) ?? 0;

            // Apply stock split: yfinance stockSplits=2.0 for a 2:1 split.
            // Raw close on the split bar is already post-split → multiply shares to keep
            // value continuous (no cliff).
            if (bar.stockSplits > 0) {
                shares.set(h.label, currentShares * bar.stockSplits);
            }

            // Apply dividend event.
            const sharesNow = shares.get(h.label) ?? 0;
            if (bar.dividends > 0 && sharesNow > 0) {
                const divCash = sharesNow * bar.dividends;
                dividendsByLabel.set(
                    h.label,
                    (dividendsByLabel.get(h.label) ?? 0) + divCash
                );
                if (h.drip && bar.close > 0) {
                    // Reinvest: buy additional fractional shares at today's close.
                    shares.set(h.label, sharesNow + divCash / bar.close);
                    dividendSchedule.push({
                        date,
                        label: h.label,
                        perShare: bar.dividends,
                        cash: 0,
                    });
                } else {
                    cash += divCash;
                    dividendSchedule.push({
                        date,
                        label: h.label,
                        perShare: bar.dividends,
                        cash: divCash,
                    });
                }
            }
        }

        // Portfolio value at close: sum of all holdings + cash.
        let totalValue = cash;
        for (const h of holdings) {
            const bar = dateIndexes.get(h.label)?.get(date);
            if (bar) totalValue += (shares.get(h.label) ?? 0) * bar.close;
        }
        timeline.push({ date, value: totalValue });
    }

    if (timeline.length === 0) return buildEmptyResult(budget);

    // ── Metrics ──────────────────────────────────────────────────────────────
    const portfolioValues = timeline.map((t) => t.value);
    // Guard: with the length check above, these are always defined.
    const vStart = portfolioValues[0] ?? budget;
    const vEnd = portfolioValues[portfolioValues.length - 1] ?? budget;
    // Approximate years from trading-day count (252 days/year convention).
    const years = Math.max(sortedDates.length / 252, 1 / 365);

    const cagrValue = computeCagr(vStart, vEnd, years);
    const mdd = computeMaxDrawdown(portfolioValues);
    const simpleReturns = computeDailyReturns(portfolioValues);
    const vol = computeVolatility(simpleReturns);
    const sharpeValue = computeSharpe(cagrValue, vol, riskFreeRate);
    const totalDividends = Array.from(dividendsByLabel.values()).reduce(
        (a, b) => a + b,
        0
    );

    // ── Per-holding results ───────────────────────────────────────────────────
    const perHolding: PerHoldingResult[] = holdings.map((h) => {
        const bar = dateIndexes.get(h.label)?.get(globalTo);
        const finalShares = shares.get(h.label) ?? 0;
        const finalVal = bar ? finalShares * bar.close : 0;
        const initVal = initialAlloc.get(h.label) ?? 0;
        return {
            label: h.label,
            shares: finalShares,
            finalValue: finalVal,
            totalReturnPct: initVal > 0 ? (finalVal - initVal) / initVal : 0,
            dividendsReceived: dividendsByLabel.get(h.label) ?? 0,
        };
    });

    // ── Projection ───────────────────────────────────────────────────────────
    const logRets = computeLogReturns(portfolioValues);
    const projection = buildProjection({
        vEnd,
        cagrValue,
        logReturns: logRets,
        cumulativeDividends: totalDividends,
        budget,
        years,
        endDate: globalTo,
        seed,
    });

    return {
        timeline,
        metrics: {
            finalValue: vEnd,
            totalReturnPct: vStart > 0 ? (vEnd - vStart) / vStart : 0,
            cagr: cagrValue,
            maxDrawdown: mdd,
            volatility: vol,
            sharpe: sharpeValue,
            cumulativeDividends: totalDividends,
        },
        perHolding,
        dividends: {
            byLabel: Object.fromEntries(dividendsByLabel),
            total: totalDividends,
            schedule: dividendSchedule,
        },
        projection,
    };
}
