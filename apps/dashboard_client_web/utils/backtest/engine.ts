// utils/backtest/engine.ts
// Purpose: orchestrates the backtest walk — lump-sum and/or DCA (Phase X / XE.1).
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
    computeDailyReturnsWithFlows,
    computeLogReturnsWithFlows,
    computeVolatility,
    computeSharpe,
    computeXirr,
} from './metrics';
import { buildProjection } from './projection';
import { buildContributionDates } from './contributions';
import { investCash } from './invest';
import { applyDividends } from './dividends';

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

// ── Main engine ───────────────────────────────────────────────────────────────

export function runBacktest(input: BacktestInput): BacktestResult {
    const {
        budget,
        holdings,
        seriesByLabel,
        range,
        seed,
        riskFreeRate,
        contribution,
    } = input;

    // Guard: bail on empty holdings OR on zero budget with no DCA plan.
    if (holdings.length === 0 || (budget <= 0 && !contribution)) {
        return buildEmptyResult(budget);
    }

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

    // ── Initial state ─────────────────────────────────────────────────────────
    const shares = new Map<string, number>();
    const initialAlloc = new Map<string, number>();
    for (const h of holdings) {
        shares.set(h.label, 0);
        initialAlloc.set(h.label, 0);
    }
    let cash = 0;
    let totalContributed = 0;

    // Lump-sum allocation at globalFrom (skipped for pure-DCA where budget = 0).
    if (budget > 0) {
        cash = investCash(globalFrom, budget, holdings, dateIndexes, shares);
        for (const h of holdings) {
            const alloc = budget * (h.weightPct / 100);
            const bar = dateIndexes.get(h.label)?.get(globalFrom);
            if (bar && bar.close > 0) initialAlloc.set(h.label, alloc);
        }
        totalContributed = budget;
    }

    // Contribution schedule (empty Set when no DCA plan).
    const contributionDates = contribution
        ? new Set(
              buildContributionDates(
                  sortedDates,
                  globalFrom,
                  globalTo,
                  contribution.freq,
                  budget === 0 // includeStart: true only for pure-DCA
              )
          )
        : new Set<string>();

    // XIRR flows (investor perspective: outflows negative, final value positive).
    const xirrFlows: { date: string; amount: number }[] = [];
    if (budget > 0) xirrFlows.push({ date: globalFrom, amount: -budget });

    // ── Date walk ─────────────────────────────────────────────────────────────
    const timeline: { date: string; value: number }[] = [];
    const dividendSchedule: DividendEvent[] = [];
    const dividendsByLabel = new Map<string, number>();
    const flowsByDate = new Map<string, number>(); // net inflow per date (Modified-Dietz)
    for (const h of holdings) dividendsByLabel.set(h.label, 0);

    for (const date of sortedDates) {
        // 1. Stock splits
        for (const h of holdings) {
            const bar = dateIndexes.get(h.label)?.get(date);
            if (!bar) continue;
            const cur = shares.get(h.label) ?? 0;
            if (bar.stockSplits > 0) shares.set(h.label, cur * bar.stockSplits);
        }

        // 2. Dividends — 2-phase pure module (XE.2 extraction).
        const { cashDelta, events, dividendAmounts } = applyDividends(
            date,
            holdings,
            dateIndexes,
            shares
        );
        cash += cashDelta;
        for (const [lbl, amt] of dividendAmounts) {
            dividendsByLabel.set(lbl, (dividendsByLabel.get(lbl) ?? 0) + amt);
        }
        dividendSchedule.push(...events);

        // 3. Contribution buy (after dividends → new cash skips today's dividend)
        if (contribution && contributionDates.has(date)) {
            cash += investCash(
                date,
                contribution.amount,
                holdings,
                dateIndexes,
                shares
            );
            totalContributed += contribution.amount;
            flowsByDate.set(date, contribution.amount);
            xirrFlows.push({ date, amount: -contribution.amount });
        }

        // 4. Snapshot
        let totalValue = cash;
        for (const h of holdings) {
            const bar = dateIndexes.get(h.label)?.get(date);
            if (bar) totalValue += (shares.get(h.label) ?? 0) * bar.close;
        }
        timeline.push({ date, value: totalValue });
    }

    if (timeline.length === 0) return buildEmptyResult(budget);

    // ── Metrics ───────────────────────────────────────────────────────────────
    const portfolioValues = timeline.map((t) => t.value);
    const vStart = portfolioValues[0] ?? budget;
    const vEnd = portfolioValues[portfolioValues.length - 1] ?? budget;
    const years = Math.max(sortedDates.length / 252, 1 / 365);

    const cagrValue = computeCagr(vStart, vEnd, years);
    const mdd = computeMaxDrawdown(portfolioValues);

    // Flow-corrected returns (Modified-Dietz): prevents contribution days from
    // spiking volatility. For lump-only, flowsArray is all-zeros → identical to
    // computeDailyReturns / computeLogReturns (back-compat guaranteed).
    const flowsArray = sortedDates.map((d) => flowsByDate.get(d) ?? 0);
    const flowCorrectedReturns = computeDailyReturnsWithFlows(
        portfolioValues,
        flowsArray
    );
    const flowCorrectedLogReturns = computeLogReturnsWithFlows(
        portfolioValues,
        flowsArray
    );
    const vol = computeVolatility(flowCorrectedReturns);
    const sharpeValue = computeSharpe(cagrValue, vol, riskFreeRate);
    const totalDividends = Array.from(dividendsByLabel.values()).reduce(
        (a, b) => a + b,
        0
    );

    // XIRR: append final portfolio value as the positive terminal flow.
    const moneyWeightedReturn = (() => {
        if (!contribution) return null;
        xirrFlows.push({ date: globalTo, amount: vEnd });
        return computeXirr(xirrFlows);
    })();

    // Total return vs total invested (lump-only ⇒ identical to old formula when vStart=budget).
    const totalReturnPct =
        totalContributed > 0 ? (vEnd - totalContributed) / totalContributed : 0;

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

    // ── Projection ────────────────────────────────────────────────────────────
    const projection = buildProjection({
        vEnd,
        cagrValue,
        logReturns: flowCorrectedLogReturns,
        cumulativeDividends: totalDividends,
        capitalBase: totalContributed,
        years,
        endDate: globalTo,
        seed,
    });

    // flowsByDate: expose only when DCA contributions exist (lump-sum → undefined).
    const flowsByDateRecord: Record<string, number> | undefined =
        flowsByDate.size > 0 ? Object.fromEntries(flowsByDate) : undefined;

    return {
        timeline,
        metrics: {
            finalValue: vEnd,
            totalReturnPct,
            cagr: cagrValue,
            maxDrawdown: mdd,
            volatility: vol,
            sharpe: sharpeValue,
            cumulativeDividends: totalDividends,
            totalContributed,
            moneyWeightedReturn,
        },
        perHolding,
        dividends: {
            byLabel: Object.fromEntries(dividendsByLabel),
            total: totalDividends,
            schedule: dividendSchedule,
        },
        projection,
        flowsByDate: flowsByDateRecord,
    };
}
