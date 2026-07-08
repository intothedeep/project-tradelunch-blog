// utils/backtest/engine.ts
// Purpose: orchestrates the backtest walk — lump-sum and/or DCA (Phase X / XE.1 / X2).
// Invariant: pure function — deterministic given input; no I/O, no Date.now(),
//            no Math.random(). All side-effects are isolated in callers.
// Note: noUncheckedIndexedAccess is enabled — all array/object access uses
//       explicit undefined guards or for-of patterns.

import type {
    BacktestInput,
    BacktestResult,
    PricePoint,
    DividendEvent,
    RebalanceState,
} from '@/types/backtest';
import { investCash } from './invest';
import { applyDividends } from './dividends';
import { reinvestDividendPool } from './dividend-pool';
import { buildInitialState } from './initial-state';
import { rebalanceIfDue } from './rebalance';
import { splitAdjustDividends } from './split-adjust';
import { advanceRunState } from './triggers';
import { buildContributionDates } from './contributions';
import {
    buildEmptyResult,
    buildManualFlowMap,
    assembleBacktestResult,
} from './engine-output';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateIndex(series: PricePoint[]): Map<string, PricePoint> {
    return new Map(series.map((p) => [p.date, p]));
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
        manualFlows,
    } = input;

    // Guard: bail on empty holdings OR on zero budget with no DCA plan.
    if (holdings.length === 0 || (budget <= 0 && !contribution)) {
        return buildEmptyResult(budget);
    }

    // Put dividends on the split-adjusted basis of `close` before indexing.
    const adjustedByLabel = new Map<string, PricePoint[]>();
    for (const label of Object.keys(seriesByLabel)) {
        const series = seriesByLabel[label];
        if (series !== undefined)
            adjustedByLabel.set(label, splitAdjustDividends(series));
    }

    // Build date indexes for O(1) lookup during the walk.
    const dateIndexes = new Map<string, Map<string, PricePoint>>();
    for (const [label, series] of adjustedByLabel) {
        dateIndexes.set(label, buildDateIndex(series));
    }

    // Build the sorted union of all trading dates within the requested range.
    const dateSet = new Set<string>();
    for (const series of adjustedByLabel.values()) {
        for (const p of series) {
            if (p.date >= range.from && p.date <= range.to) dateSet.add(p.date);
        }
    }
    const sortedDates = Array.from(dateSet).sort();
    if (sortedDates.length === 0) return buildEmptyResult(budget);

    const globalFrom = sortedDates[0] ?? '';
    const globalTo = sortedDates[sortedDates.length - 1] ?? '';
    if (!globalFrom || !globalTo) return buildEmptyResult(budget);

    // ── Initial state (extracted to initial-state.ts, X2.3) ──────────────────
    const init = buildInitialState(
        budget,
        holdings,
        dateIndexes,
        sortedDates,
        globalFrom,
        globalTo,
        contribution
    );
    const { shares, initialAlloc, contributionDates, xirrFlows } = init;
    let cash = init.cash;
    let totalContributed = init.totalContributed;

    // ── Rebalance state (X2 Wave-2) ───────────────────────────────────────────
    const rebalState: RebalanceState = {
        assets: new Map(),
        lastRebalanceDate: null,
        events: [],
        warnings: [],
        armedRebalance: false,
    };

    // ── Manual flows map (X2.18) ──────────────────────────────────────────────
    const manualFlowMap = buildManualFlowMap(manualFlows, sortedDates);

    // ── Date walk ─────────────────────────────────────────────────────────────
    const timeline: { date: string; value: number }[] = [];
    const perHoldingValuesSeries: {
        date: string;
        values: Record<string, number>;
    }[] = [];
    const dividendSchedule: DividendEvent[] = [];
    const dividendsByLabel = new Map<string, number>();
    const flowsByDate = new Map<string, number>(); // net inflow per date (Modified-Dietz)
    for (const h of holdings) dividendsByLabel.set(h.label, 0);

    // Per-asset purchase ledger (dividend reinvest + contribution/deposit buys).
    // Excludes the initial lump-sum (invested in buildInitialState, not here).
    const purchasesByDate = new Map<string, Record<string, number>>();
    const addBuy = (date: string, label: string, usd: number) => {
        if (usd <= 0) return;
        const row = purchasesByDate.get(date) ?? {};
        row[label] = (row[label] ?? 0) + usd;
        purchasesByDate.set(date, row);
    };

    for (const date of sortedDates) {
        // NOTE: `close` is SPLIT-ADJUSTED at source (Yahoo splits-adjusts OHLC
        // even under yfinance auto_adjust=False), so share counts stay constant
        // across splits — re-applying `stockSplits` here would double-count it.
        // Dividends were put on the split-adjusted basis by splitAdjustDividends().

        // 1. Dividends — 2-phase pure module (XE.2 extraction).
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
        // Reinvested dividends (cash === 0) are buys into routedTo (cross-asset)
        // or the source label (same-asset DRIP, routedTo undefined).
        for (const ev of events) {
            if (ev.cash === 0) addBuy(date, ev.routedTo ?? ev.label, ev.gross);
        }

        // 1b. Pooled dividend reinvestment (dividendReinvestByWeight flag).
        // cashDelta is the cash-routed portion produced by applyDividends above.
        // same/asset DividendRoutes produce cashDelta=0 (already reinvested) —
        // only the cash-routed slice is pooled here.
        if (input.dividendReinvestByWeight && cashDelta > 0) {
            const residual = reinvestDividendPool(
                date,
                cashDelta,
                holdings,
                dateIndexes,
                shares,
                (lbl, usd) => addBuy(date, lbl, usd)
            );
            // Only the reinvested portion leaves cash; residual stays as cash.
            cash -= cashDelta - residual;
        }

        // 2. Contribution buy (after dividends → new cash skips today's dividend)
        if (contribution && contributionDates.has(date)) {
            cash += investCash(
                date,
                contribution.amount,
                holdings,
                dateIndexes,
                shares,
                contribution.route,
                (lbl, usd) => addBuy(date, lbl, usd)
            );
            totalContributed += contribution.amount;
            flowsByDate.set(
                date,
                (flowsByDate.get(date) ?? 0) + contribution.amount
            );
            xirrFlows.push({ date, amount: -contribution.amount });
        }

        // 2b. Manual flows (X2.18) — deposit or withdrawal
        const manualAmt = manualFlowMap.get(date);
        if (manualAmt !== undefined && manualAmt !== 0) {
            if (manualAmt > 0) {
                // Deposit: invest using same route as regular contributions
                const residual = investCash(
                    date,
                    manualAmt,
                    holdings,
                    dateIndexes,
                    shares,
                    contribution?.route,
                    (lbl, usd) => addBuy(date, lbl, usd)
                );
                cash += residual;
                totalContributed += manualAmt;
                flowsByDate.set(date, (flowsByDate.get(date) ?? 0) + manualAmt);
                xirrFlows.push({ date, amount: -manualAmt });
            } else {
                // Withdrawal: reduce cash first, then sell pro-rata if needed
                const withdrawAmt = -manualAmt; // positive amount to withdraw
                if (cash >= withdrawAmt) {
                    cash -= withdrawAmt;
                } else {
                    // Need to sell holdings pro-rata to cover shortfall
                    const cashNeeded = withdrawAmt - cash;
                    cash = 0;
                    // Compute total equity value
                    let totalEquity = 0;
                    for (const h of holdings) {
                        const bar = dateIndexes.get(h.label)?.get(date);
                        if (bar && bar.close > 0) {
                            totalEquity +=
                                (shares.get(h.label) ?? 0) * bar.close;
                        }
                    }
                    // Sell pro-rata (guard: never go negative)
                    const sellFraction =
                        totalEquity > 0
                            ? Math.min(cashNeeded / totalEquity, 1)
                            : 0;
                    for (const h of holdings) {
                        const bar = dateIndexes.get(h.label)?.get(date);
                        if (bar && bar.close > 0) {
                            const qty = shares.get(h.label) ?? 0;
                            const sellShares = qty * sellFraction;
                            shares.set(h.label, qty - sellShares);
                        }
                    }
                }
                // Withdrawal is a negative contribution for XIRR / Modified-Dietz
                totalContributed += manualAmt; // manualAmt < 0 → reduces total
                flowsByDate.set(date, (flowsByDate.get(date) ?? 0) + manualAmt);
                xirrFlows.push({ date, amount: -manualAmt }); // positive = inflow to investor
            }
        }

        // 3. Advance run state (every bar, before rebalanceIfDue)
        advanceRunState(rebalState, holdings, dateIndexes, date);

        // 4. Rebalance (Wave-2 live; no-op when policy absent)
        cash = rebalanceIfDue(
            date,
            shares,
            cash,
            rebalState,
            input.rebalance,
            holdings,
            dateIndexes
        );

        // 5. Snapshot
        let totalValue = cash;
        const holdingValues: Record<string, number> = {};
        for (const h of holdings) {
            const bar = dateIndexes.get(h.label)?.get(date);
            const val = bar ? (shares.get(h.label) ?? 0) * bar.close : 0;
            totalValue += val;
            holdingValues[h.label] = val;
        }
        timeline.push({ date, value: totalValue });
        perHoldingValuesSeries.push({ date, values: holdingValues });
    }

    if (timeline.length === 0) return buildEmptyResult(budget);

    // Map insertion order follows the walk (ascending dates) → already sorted.
    const perAssetPurchases = Array.from(purchasesByDate, ([date, buys]) => ({
        date,
        buys,
    }));

    return assembleBacktestResult({
        budget,
        timeline,
        perHoldingValuesSeries,
        perAssetPurchases,
        sortedDates,
        flowsByDate,
        holdings,
        dateIndexes,
        globalTo,
        shares,
        initialAlloc,
        dividendsByLabel,
        dividendSchedule,
        xirrFlows,
        totalContributed,
        contribution,
        manualFlows,
        rebalPolicy: input.rebalance,
        rebalState,
        riskFreeRate,
        seed,
    });
}

// Re-export buildContributionDates for tests that use it via engine path
export { buildContributionDates };
