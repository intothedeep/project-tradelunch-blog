// __tests__/helpers/priceSignals.test.ts
// Purpose: unit tests for the pure price-signal helpers (momentum, vol, percentileRank).
// No I/O — deterministic.

import {
    computeRawMomentum,
    computeAnnualizedVol,
    percentileRank,
} from '../../src/helpers/priceSignals';

// Ascending linear closes 100,101,...  length n.
function linearCloses(n: number, start = 100): number[] {
    return Array.from({ length: n }, (_, i) => start + i);
}

describe('computeRawMomentum', () => {
    it('returns null when fewer than 253 bars', () => {
        expect(computeRawMomentum(linearCloses(252))).toBeNull();
        expect(computeRawMomentum([])).toBeNull();
    });

    it('computes close[t-21]/close[t-252]-1 with exactly 253 bars', () => {
        // n=253: past index 0 (=100), recent index 231 (=331) → 331/100-1 = 2.31
        const closes = linearCloses(253);
        expect(computeRawMomentum(closes)).toBeCloseTo(331 / 100 - 1);
    });

    it('uses only the skip/lookback window, ignoring older extra bars', () => {
        // 300 bars: past index n-1-252 = 47 (=147), recent index n-1-21 = 278 (=378)
        const closes = linearCloses(300);
        expect(computeRawMomentum(closes)).toBeCloseTo(378 / 147 - 1);
    });

    it('returns null when the lookback price is non-positive', () => {
        const closes = linearCloses(253);
        closes[0] = 0;
        expect(computeRawMomentum(closes)).toBeNull();
    });
});

describe('computeAnnualizedVol', () => {
    it('returns null with fewer than 61 closes', () => {
        expect(computeAnnualizedVol(linearCloses(60))).toBeNull();
    });

    it('returns 0 for a perfectly flat series (no return variance)', () => {
        const flat = Array.from({ length: 100 }, () => 100);
        expect(computeAnnualizedVol(flat)).toBeCloseTo(0);
    });

    it('returns a positive annualised vol for a varying series', () => {
        // Alternating up/down closes → non-zero daily-return stdev.
        const closes = Array.from({ length: 120 }, (_, i) =>
            i % 2 === 0 ? 100 : 102
        );
        const vol = computeAnnualizedVol(closes);
        expect(vol).not.toBeNull();
        expect(vol as number).toBeGreaterThan(0);
    });

    it('returns null when any close in the window is non-positive', () => {
        const closes = linearCloses(120);
        closes[119] = -5;
        expect(computeAnnualizedVol(closes)).toBeNull();
    });
});

describe('percentileRank', () => {
    it('ranks distinct values to 0, 0.5, 1', () => {
        expect(percentileRank([10, 20, 30])).toEqual([0, 0.5, 1]);
    });

    it('preserves nulls and ranks among the non-null set', () => {
        expect(percentileRank([10, null, 30])).toEqual([0, null, 1]);
    });

    it('gives a lone non-null value the neutral 0.5', () => {
        expect(percentileRank([5])).toEqual([0.5]);
        expect(percentileRank([null, 5, null])).toEqual([null, 0.5, null]);
    });

    it('ties share the same rank (strictly-less count)', () => {
        expect(percentileRank([10, 10, 20])).toEqual([0, 0, 1]);
    });

    it('returns all null for an all-null input', () => {
        expect(percentileRank([null, null])).toEqual([null, null]);
    });
});
