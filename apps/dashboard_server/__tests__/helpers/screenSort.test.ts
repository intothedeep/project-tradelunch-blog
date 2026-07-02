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
    lowVol: number | null
): ScoreComponents {
    return { consensus: 1, capTier: 1, momentum, lowVol };
}

function cand(
    score: number,
    holderCountActive: number,
    momentum: number | null,
    lowVol: number | null
) {
    return { score, holderCountActive, components: comps(momentum, lowVol) };
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

    it('breaks score ties by holderCountActive DESC', () => {
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
});
