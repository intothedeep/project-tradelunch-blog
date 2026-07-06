// utils/backtest/invest.ts
// Purpose: pure cash-to-shares allocation helper shared by engine.ts.
// Invariant: no I/O, no side effects beyond mutating the caller-owned `shares` Map.

import type { Holding, PricePoint } from '@/types/backtest';

/**
 * Buy shares proportionally at `date` using `amount` of cash.
 * Adds fractional shares to existing positions (safe for initial lump-sum
 * and recurring contributions alike).
 * Returns any residual cash that could not be invested because no price bar
 * was available at `date` for that holding.
 */
export function investCash(
    date: string,
    amount: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    shares: Map<string, number>
): number {
    let residual = 0;
    for (const h of holdings) {
        const alloc = amount * (h.weightPct / 100);
        const bar = dateIndexes.get(h.label)?.get(date);
        if (bar && bar.close > 0) {
            shares.set(h.label, (shares.get(h.label) ?? 0) + alloc / bar.close);
        } else {
            residual += alloc;
        }
    }
    return residual;
}
