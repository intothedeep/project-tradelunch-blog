// calibrate.test.ts — X2-P2b.5 deterministic structural calibration
import { describe, expect, it } from 'vitest';
import { calibrateStructural } from './calibrate';
import {
    structuralSteps,
    structuralTotalReturns,
    structuralYield,
    type StructuralBar,
} from './overlay';
import type { OverlapResult, StructuralParams, VolPoint } from './types';

const RF = 0.03;
const TRUE: StructuralParams = {
    beta: 0.92,
    moneyness: 0.012,
    coverage: 0.28,
    haircut: 0.82,
};

/** 'YYYY-MM-DD' `i` days after 2020-01-01 (UTC). */
function dayOffset(i: number): string {
    const d = new Date('2020-01-01T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
}

// Deterministic daily base path: drift + oscillation → intra-month rallies that
// exceed the strike (activates give-back ⇒ coverage identifiable) plus down days.
function makeBars(n: number): StructuralBar[] {
    const bars: StructuralBar[] = [];
    for (let i = 0; i < n; i++) {
        const rBase = 0.002 + 0.004 * Math.sin(i * 0.3);
        bars.push({ date: dayOffset(i), rBase });
    }
    return bars;
}

const N = 360;
const bars = makeBars(N);
const dates = bars.map((b) => b.date);
const volByDate = new Map<string, VolPoint>(
    dates.map((d) => [d, { sigma: 0.25, isProxy: false }])
);

// Build the "actual" overlap FROM the true params (objective = 0 at truth).
const trueSteps = structuralSteps(TRUE, bars, volByDate, RF);
const rShort = structuralTotalReturns(trueSteps);
const realizedYield = structuralYield(trueSteps, dates);

const overlap: OverlapResult = {
    bars: bars.map((b, i) => ({
        date: b.date,
        rBase: b.rBase,
        rShort: rShort[i]!,
    })),
    realInception: dayOffset(N),
    shortAnnualYield: realizedYield,
};

describe('calibrateStructural — recovers known params by grid descent', () => {
    const fit = calibrateStructural(overlap, volByDate, realizedYield, RF);

    it('recovers params within identifiability-appropriate tolerance', () => {
        // Daily returns are small (~0.4%), so the objective is near-flat in
        // beta / moneyness — they are recovered to a band, not to the bit. Their
        // residual slack couples weakly into the premium, so coverage·haircut is
        // the sharply identified premium quantity (tighter band than either
        // factor alone).
        expect(Math.abs(fit.params.beta - TRUE.beta)).toBeLessThan(0.03);
        expect(Math.abs(fit.params.moneyness - TRUE.moneyness)).toBeLessThan(
            0.005
        );
        expect(
            Math.abs(
                fit.params.coverage * fit.params.haircut -
                    TRUE.coverage * TRUE.haircut
            )
        ).toBeLessThan(0.02);
        expect(Math.abs(fit.params.coverage - TRUE.coverage)).toBeLessThan(
            0.06
        );
        expect(Math.abs(fit.params.haircut - TRUE.haircut)).toBeLessThan(0.1);
    });

    it('near-perfect fit at recovered params (TE→0, r2→1)', () => {
        expect(fit.trackingError).toBeGreaterThanOrEqual(0);
        expect(fit.trackingError).toBeLessThan(1e-3);
        expect(fit.r2).toBeGreaterThanOrEqual(0);
        expect(fit.r2).toBeLessThanOrEqual(1);
        expect(fit.r2).toBeGreaterThan(0.99);
    });

    it('respects bounds', () => {
        expect(fit.params.beta).toBeGreaterThanOrEqual(0.85);
        expect(fit.params.beta).toBeLessThanOrEqual(1.0);
        expect(fit.params.moneyness).toBeGreaterThanOrEqual(0.003);
        expect(fit.params.moneyness).toBeLessThanOrEqual(0.025);
        expect(fit.params.coverage).toBeGreaterThanOrEqual(0.1);
        expect(fit.params.coverage).toBeLessThanOrEqual(0.4);
        expect(fit.params.haircut).toBeGreaterThanOrEqual(0.6);
        expect(fit.params.haircut).toBeLessThanOrEqual(0.95);
    });

    it('is deterministic (bit-identical on repeat, no RNG)', () => {
        const again = calibrateStructural(
            overlap,
            volByDate,
            realizedYield,
            RF
        );
        expect(again).toEqual(fit);
    });
});
