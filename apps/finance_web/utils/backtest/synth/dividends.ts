// utils/backtest/synth/dividends.ts
// Purpose: synthesize the `dividends` field on synthetic pre-inception bars from
//          the overlap's annualized realized distribution yield (X2-P2.5).
// Invariant: pure, deterministic — no I/O, no RNG.
//
// The short asset (e.g. JEPQ) pays monthly. We reproduce that cadence on the
// synthetic span: on the FIRST trading bar of each calendar month, attach a
// per-share dividend = close · (annualYield / 12). Flat yield (no shape). This
// keeps the synthetic-span annualized yield ≈ the realized overlap yield.

import type { PricePoint } from '@/types/backtest';

/**
 * Return a NEW PricePoint[] with monthly synthetic dividends attached.
 * Input `points` are ascending synthetic bars (dividends assumed 0). The input
 * is not mutated.
 *
 * @param points        ascending synthetic bars
 * @param annualYield   realized annualized distribution yield (fraction ≥ 0)
 */
export function synthesizeDividends(
    points: PricePoint[],
    annualYield: number
): PricePoint[] {
    const monthlyRate = Math.max(annualYield, 0) / 12;
    if (points.length === 0 || monthlyRate <= 0) {
        // Nothing to distribute — return a shallow copy for purity.
        return points.map((p) => ({ ...p }));
    }

    let seenMonth = '';
    return points.map((p) => {
        const month = p.date.slice(0, 7); // 'YYYY-MM'
        let dividends = 0;
        if (month !== seenMonth) {
            // First trading bar of a new calendar month → pay the monthly slice.
            dividends = Math.max(p.close, 0) * monthlyRate;
            seenMonth = month;
        }
        return { ...p, dividends };
    });
}
