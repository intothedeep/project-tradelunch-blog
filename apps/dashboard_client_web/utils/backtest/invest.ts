// utils/backtest/invest.ts
// Purpose: pure cash-to-shares allocation helper shared by engine.ts.
// Invariant: no I/O, no side effects beyond mutating the caller-owned `shares` Map.

import type { ContributionRoute, Holding, PricePoint } from '@/types/backtest';

/**
 * Buy shares proportionally at `date` using `amount` of cash.
 * Adds fractional shares to existing positions (safe for initial lump-sum
 * and recurring contributions alike).
 *
 * @param route - How to allocate the cash. Defaults to byWeight (legacy behaviour).
 *   byWeight: spread proportionally by holding.weightPct (original behaviour — identical output).
 *   {kind:'asset',target}: ALL cash → one named label.
 *
 * Returns any residual cash that could not be invested because no price bar
 * was available at `date` for that holding.
 *
 * @param onBuy - optional per-asset buy recorder, invoked with (label, usd) for
 *   each portion actually deployed into shares. Used to build the per-asset
 *   purchase ledger; omit for the initial lump-sum so it is excluded.
 */
export function investCash(
    date: string,
    amount: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    shares: Map<string, number>,
    route?: ContributionRoute,
    onBuy?: (label: string, usd: number) => void
): number {
    // Default: byWeight (original behaviour — byte-identical when route is absent)
    if (route === undefined || route.kind === 'byWeight') {
        let residual = 0;
        for (const h of holdings) {
            const alloc = amount * (h.weightPct / 100);
            const bar = dateIndexes.get(h.label)?.get(date);
            if (bar && bar.close > 0) {
                shares.set(
                    h.label,
                    (shares.get(h.label) ?? 0) + alloc / bar.close
                );
                onBuy?.(h.label, alloc);
            } else {
                residual += alloc;
            }
        }
        return residual;
    }

    // asset route: ALL cash → single target label
    const target = route.target;
    const bar = dateIndexes.get(target)?.get(date);
    if (bar && bar.close > 0) {
        shares.set(target, (shares.get(target) ?? 0) + amount / bar.close);
        onBuy?.(target, amount);
        return 0;
    }
    // Target has no bar today → all residual
    return amount;
}
