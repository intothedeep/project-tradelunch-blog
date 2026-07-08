// utils/backtest/dividend-pool.ts
// Purpose: pure helper — pool cash-routed dividends and reinvest by divPct weighting.
// SRP: only handles pooled dividend reinvestment; per-asset DRIP is in dividends.ts.
// Invariant: no I/O, no Date, no Math.random(). Deterministic — iterates holdings in
//   list order (stable, caller-owned). `shares` is mutated in-place (engine convention).

import type { Holding, PricePoint } from '@/types/backtest';

type DateIndex = Map<string, Map<string, PricePoint>>;
type SharesMap = Map<string, number>;

/**
 * Reinvest `pooledCash` across holdings in list order, splitting by
 * `(h.divPct ?? h.weightPct) / 100`. Buys fractional shares when a priced
 * bar exists on `date`; accumulates residual otherwise.
 *
 * @param onBuy - invoked per portion actually deployed (label, usd); feeds addBuy ledger.
 * @returns residual USD that could NOT be invested (no bar / zero close on that date).
 */
export function reinvestDividendPool(
    date: string,
    pooledCash: number,
    holdings: Holding[],
    dateIndexes: DateIndex,
    shares: SharesMap,
    onBuy: (label: string, usd: number) => void
): number {
    let residual = 0;
    for (const h of holdings) {
        const alloc = pooledCash * ((h.divPct ?? h.weightPct) / 100);
        if (alloc <= 0) continue;
        const bar = dateIndexes.get(h.label)?.get(date);
        if (bar && bar.close > 0) {
            shares.set(h.label, (shares.get(h.label) ?? 0) + alloc / bar.close);
            onBuy(h.label, alloc);
        } else {
            residual += alloc;
        }
    }
    return residual;
}
