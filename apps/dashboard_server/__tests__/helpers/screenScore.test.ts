// __tests__/helpers/screenScore.test.ts
// Purpose: unit tests for the pure computeScore helper.
// No I/O — no mocks needed.

import { computeScore } from '../../src/helpers/screenScore';

describe('computeScore — consensus term', () => {
    it('returns consensus=1 when holderCountActive equals totalActiveFunds', () => {
        const { components } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: null });
        expect(components.consensus).toBe(1);
    });

    it('clamps consensus to 1 when holderCountActive exceeds totalActiveFunds', () => {
        const { components } = computeScore({ holderCountActive: 5, totalActiveFunds: 3, rank: null });
        expect(components.consensus).toBe(1);
    });

    it('returns consensus=0 when totalActiveFunds is 0 (avoid divide-by-zero)', () => {
        const { components } = computeScore({ holderCountActive: 2, totalActiveFunds: 0, rank: null });
        expect(components.consensus).toBe(0);
    });

    it('returns fractional consensus', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: null });
        expect(components.consensus).toBeCloseTo(1 / 3);
    });

    it('clamps consensus to 0 when holderCountActive is 0', () => {
        const { components } = computeScore({ holderCountActive: 0, totalActiveFunds: 3, rank: null });
        expect(components.consensus).toBe(0);
    });
});

describe('computeScore — capTier term', () => {
    it('returns capTier=0 when rank is null', () => {
        const { components } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: null });
        expect(components.capTier).toBe(0);
    });

    it('returns capTier=1 for rank=1 (top)', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 1 });
        expect(components.capTier).toBe(1);
    });

    it('returns capTier=1 for rank=20 (boundary inclusive)', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 20 });
        expect(components.capTier).toBe(1);
    });

    it('returns capTier=0.5 for rank=21 (just outside top-20)', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 21 });
        expect(components.capTier).toBe(0.5);
    });

    it('returns capTier=0.5 for rank=100 (boundary inclusive)', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 100 });
        expect(components.capTier).toBe(0.5);
    });

    it('returns capTier=0 for rank=101 (just outside top-100)', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 101 });
        expect(components.capTier).toBe(0);
    });

    it('returns capTier=0 for large rank', () => {
        const { components } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 500 });
        expect(components.capTier).toBe(0);
    });
});

describe('computeScore — score sum', () => {
    it('computes score = 0.4*consensus + 0.2*capTier', () => {
        // consensus=1, capTier=1 → score=0.6
        const { score } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: 1 });
        expect(score).toBeCloseTo(0.6);
    });

    it('max score is 0.6 with current deferred weights', () => {
        const { score } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: 1 });
        expect(score).toBeCloseTo(0.6);
    });

    it('score with partial consensus and top rank', () => {
        // consensus=1/3, capTier=1 → 0.4*(1/3) + 0.2*1 ≈ 0.333
        const { score } = computeScore({ holderCountActive: 1, totalActiveFunds: 3, rank: 10 });
        expect(score).toBeCloseTo(0.4 * (1 / 3) + 0.2 * 1);
    });

    it('score=0 when consensus=0 and rank=null', () => {
        const { score } = computeScore({ holderCountActive: 0, totalActiveFunds: 3, rank: null });
        expect(score).toBe(0);
    });
});

describe('computeScore — deferred terms', () => {
    it('momentum is always null', () => {
        const { components } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: 1 });
        expect(components.momentum).toBeNull();
    });

    it('lowVol is always null', () => {
        const { components } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: 1 });
        expect(components.lowVol).toBeNull();
    });
});
