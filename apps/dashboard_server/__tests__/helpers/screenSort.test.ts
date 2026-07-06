// __tests__/helpers/screenSort.test.ts
// Purpose: unit tests for the pure two-tier ordering helpers.
// No I/O.

import {
    hasPriceSignals,
    compareScreenCandidates,
} from '../../src/helpers/screenSort';
import type { ScoreComponents } from '../../src/helpers/screenScore';

function comps(
    momentum: number | null,
    lowVol: number | null,
    newPositionBreadth: number | null = null
): ScoreComponents {
    return { consensus: 1, capTier: 1, momentum, lowVol, newPositionBreadth };
}

function cand(
    score: number,
    holderCountActive: number,
    momentum: number | null,
    lowVol: number | null,
    newPositionBreadth: number | null = null
) {
    return {
        score,
        holderCountActive,
        newPositionBreadth,
        components: comps(momentum, lowVol, newPositionBreadth),
    };
}

describe('hasPriceSignals', () => {
    it('is true only when BOTH momentum and lowVol are present', () => {
        expect(hasPriceSignals(comps(0.5, 0.5))).toBe(true);
    });

    it('is false when either price term is null', () => {
        expect(hasPriceSignals(comps(0.5, null))).toBe(false);
        expect(hasPriceSignals(comps(null, 0.5))).toBe(false);
        expect(hasPriceSignals(comps(null, null))).toBe(false);
    });
});

describe('compareScreenCandidates', () => {
    it('puts a price-signal-complete candidate before a consensus-only one, even at lower score', () => {
        const full = cand(0.2, 1, 0.1, 0.1); // low score but has price signals
        const partial = cand(0.6, 3, null, null); // high partial score, no signals
        expect(compareScreenCandidates(full, partial)).toBeLessThan(0);
        expect(compareScreenCandidates(partial, full)).toBeGreaterThan(0);
    });

    it('within the same tier, sorts by score DESC', () => {
        const hi = cand(0.9, 1, 0.5, 0.5);
        const lo = cand(0.7, 1, 0.5, 0.5);
        expect(compareScreenCandidates(hi, lo)).toBeLessThan(0);
    });

    it('breaks score ties by holderCountActive DESC when newPositionBreadth both null', () => {
        const many = cand(0.6, 3, null, null);
        const few = cand(0.6, 1, null, null);
        expect(compareScreenCandidates(many, few)).toBeLessThan(0);
    });

    it('a one-sided price term stays in the consensus-only tier', () => {
        const oneSided = cand(0.9, 1, 0.9, null); // only momentum
        const full = cand(0.2, 1, 0.1, 0.1);
        // full (both signals) still ranks ahead of the one-sided high score.
        expect(compareScreenCandidates(full, oneSided)).toBeLessThan(0);
    });

    it('sorts a mixed array into [full tier by score] then [partial tier by score]', () => {
        const arr = [
            cand(0.55, 2, null, null), // partial B
            cand(0.85, 1, 0.6, 0.6), // full A
            cand(0.6, 3, null, null), // partial A
            cand(0.7, 1, 0.4, 0.4), // full B
        ];
        arr.sort(compareScreenCandidates);
        expect(arr.map((c) => c.score)).toEqual([0.85, 0.7, 0.6, 0.55]);
    });

    // --- newPositionBreadth tiebreak tests ---

    it('equal tier + equal score → higher newPositionBreadth ranks first', () => {
        const highNpb = cand(0.6, 2, null, null, 0.8);
        const lowNpb = cand(0.6, 2, null, null, 0.3);
        expect(compareScreenCandidates(highNpb, lowNpb)).toBeLessThan(0);
        expect(compareScreenCandidates(lowNpb, highNpb)).toBeGreaterThan(0);
    });

    it('null newPositionBreadth sorts after a non-null value (nulls last)', () => {
        const withData = cand(0.6, 2, null, null, 0.2);
        const noData = cand(0.6, 2, null, null, null);
        expect(compareScreenCandidates(withData, noData)).toBeLessThan(0);
        expect(compareScreenCandidates(noData, withData)).toBeGreaterThan(0);
    });

    it('both null newPositionBreadth → falls back to holderCountActive DESC', () => {
        const manyHolders = cand(0.6, 5, null, null, null);
        const fewHolders = cand(0.6, 2, null, null, null);
        expect(compareScreenCandidates(manyHolders, fewHolders)).toBeLessThan(
            0
        );
    });

    it('equal newPositionBreadth → falls back to holderCountActive DESC', () => {
        const manyHolders = cand(0.6, 5, null, null, 0.5);
        const fewHolders = cand(0.6, 2, null, null, 0.5);
        expect(compareScreenCandidates(manyHolders, fewHolders)).toBeLessThan(
            0
        );
    });

    it('tier takes precedence over newPositionBreadth (full tier ranks before partial even with null npb)', () => {
        const fullNoNpb = cand(0.3, 1, 0.1, 0.1, null); // has price signals
        const partialHighNpb = cand(0.9, 1, null, null, 1.0); // no price signals but highest npb
        expect(compareScreenCandidates(fullNoNpb, partialHighNpb)).toBeLessThan(
            0
        );
    });

    it('score DESC takes precedence over newPositionBreadth', () => {
        const highScore = cand(0.9, 1, null, null, 0.1);
        const lowScoreHighNpb = cand(0.5, 1, null, null, 1.0);
        expect(
            compareScreenCandidates(highScore, lowScoreHighNpb)
        ).toBeLessThan(0);
    });

    it('result is antisymmetric (compare(a,b) === -compare(b,a) sign-wise)', () => {
        const a = cand(0.6, 2, null, null, 0.7);
        const b = cand(0.6, 2, null, null, 0.3);
        const ab = compareScreenCandidates(a, b);
        const ba = compareScreenCandidates(b, a);
        expect(Math.sign(ab)).toBe(-Math.sign(ba));
    });

    it('deterministic: same array sorts identically on repeated calls', () => {
        const arr = [
            cand(0.6, 3, null, null, 0.5),
            cand(0.6, 3, null, null, 0.8),
            cand(0.6, 3, null, null, null),
            cand(0.6, 3, null, null, 0.2),
        ];
        const sorted1 = [...arr]
            .sort(compareScreenCandidates)
            .map((c) => c.newPositionBreadth);
        const sorted2 = [...arr]
            .sort(compareScreenCandidates)
            .map((c) => c.newPositionBreadth);
        expect(sorted1).toEqual(sorted2);
        // Expected order: 0.8, 0.5, 0.2, null
        expect(sorted1).toEqual([0.8, 0.5, 0.2, null]);
    });
});
