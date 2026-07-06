// utils/backtest/split-adjust.ts
// Purpose: rebase raw (as-paid) per-share dividends onto the split-adjusted
//          share basis used by `close`. Extracted from engine.ts (X2.3).
// Invariant: pure — returns a new array; input series is never mutated.

import type { PricePoint } from '@/types/backtest';

/**
 * Put per-share dividends on the SAME basis as `close`.
 *
 * market_history feeds split-adjusted `close` but RAW (as-paid) `dividends`
 * (yfinance auto_adjust=False). Share counts sit on the split-adjusted basis,
 * so a raw dividend paid before a split is over-counted by that split factor
 * when multiplied by the (inflated) share count — QLD's six 2:1 splits
 * over-count a 2006 dividend by 2^6 = 64×. Divide each dividend by the product
 * of splits that occur strictly AFTER its bar. One reverse pass per series;
 * `close` and `stockSplits` are left untouched.
 */
export function splitAdjustDividends(series: PricePoint[]): PricePoint[] {
    let trailingSplit = 1; // product of splits strictly after the current bar
    const out = series.slice();
    for (let i = series.length - 1; i >= 0; i--) {
        const p = series[i];
        if (!p) continue;
        if (p.dividends > 0 && trailingSplit !== 1) {
            out[i] = { ...p, dividends: p.dividends / trailingSplit };
        }
        if (p.stockSplits > 0) trailingSplit *= p.stockSplits;
    }
    return out;
}
