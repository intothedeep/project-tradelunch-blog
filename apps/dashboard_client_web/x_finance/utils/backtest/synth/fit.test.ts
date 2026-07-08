// fit.test.ts — X2-P2.3
import { describe, expect, it } from 'vitest';
import { fitRegression } from './fit';
import type { OverlapBar, OverlapResult } from './types';

function makeOverlap(bars: OverlapBar[]): OverlapResult {
    return { bars, realInception: '2020-01-01', shortAnnualYield: 0 };
}

describe('fitRegression — asymmetric two-regime OLS', () => {
    it('recovers known β_up ≠ β_down (covered-call: β_up < β_down)', () => {
        // Construct exact linear data per regime (zero residual).
        //   up:   rShort = 0.001 + 0.6·rBase   for rBase ≥ 0
        //   down: rShort = 0.001 + 1.3·rBase   for rBase < 0
        const bars: OverlapBar[] = [];
        for (let i = 1; i <= 40; i++) {
            const rUp = 0.0005 * i; // positive
            bars.push({
                date: `up-${i}`,
                rBase: rUp,
                rShort: 0.001 + 0.6 * rUp,
            });
            const rDn = -0.0005 * i; // negative
            bars.push({
                date: `dn-${i}`,
                rBase: rDn,
                rShort: 0.001 + 1.3 * rDn,
            });
        }
        const fit = fitRegression(makeOverlap(bars));
        expect(fit.betaUp).toBeCloseTo(0.6, 6);
        expect(fit.betaDown).toBeCloseTo(1.3, 6);
        expect(fit.alphaUp).toBeCloseTo(0.001, 6);
        expect(fit.alphaDown).toBeCloseTo(0.001, 6);
        expect(fit.betaUp).toBeLessThan(fit.betaDown);
    });

    it('R² ∈ [0,1] and ≈ 1 for noiseless data; residual mean ≈ 0', () => {
        const bars: OverlapBar[] = [];
        for (let i = 1; i <= 30; i++) {
            const r = i % 2 === 0 ? 0.001 * i : -0.001 * i;
            const beta = r >= 0 ? 0.5 : 1.2;
            bars.push({ date: `d-${i}`, rBase: r, rShort: 0.002 + beta * r });
        }
        const fit = fitRegression(makeOverlap(bars));
        expect(fit.r2).toBeGreaterThanOrEqual(0);
        expect(fit.r2).toBeLessThanOrEqual(1);
        expect(fit.r2).toBeGreaterThan(0.99);
        const mean =
            fit.residuals.reduce((a, b) => a + b, 0) / fit.residuals.length;
        expect(Math.abs(mean)).toBeLessThan(1e-9);
    });

    it('residuals align to overlap order and length', () => {
        const bars: OverlapBar[] = [
            { date: 'a', rBase: 0.01, rShort: 0.02 },
            { date: 'b', rBase: -0.01, rShort: -0.02 },
            { date: 'c', rBase: 0.02, rShort: 0.01 },
        ];
        const fit = fitRegression(makeOverlap(bars));
        expect(fit.residuals).toHaveLength(3);
    });

    it('is deterministic (pure OLS, no RNG)', () => {
        const bars: OverlapBar[] = [
            { date: 'a', rBase: 0.01, rShort: 0.02 },
            { date: 'b', rBase: -0.02, rShort: -0.03 },
            { date: 'c', rBase: 0.03, rShort: 0.015 },
            { date: 'd', rBase: -0.01, rShort: -0.02 },
        ];
        expect(fitRegression(makeOverlap(bars))).toEqual(
            fitRegression(makeOverlap(bars))
        );
    });
});
