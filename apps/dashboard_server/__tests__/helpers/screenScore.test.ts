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

    it('partial max is 0.6 when momentum/lowVol are absent (null)', () => {
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

describe('computeScore — price terms (momentum + lowVol)', () => {
    it('defaults momentum/lowVol to null when omitted (partial-score contract)', () => {
        const { components } = computeScore({ holderCountActive: 3, totalActiveFunds: 3, rank: 1 });
        expect(components.momentum).toBeNull();
        expect(components.lowVol).toBeNull();
    });

    it('adds 0.3*momentum when a normalised momentum is supplied', () => {
        // consensus=1, capTier=1 (0.6) + 0.3*1 = 0.9
        const { score, components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, momentum: 1,
        });
        expect(components.momentum).toBe(1);
        expect(score).toBeCloseTo(0.9);
    });

    it('adds 0.1*lowVol when a normalised lowVol is supplied', () => {
        // 0.6 + 0.1*1 = 0.7
        const { score } = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, lowVol: 1,
        });
        expect(score).toBeCloseTo(0.7);
    });

    it('reaches full max 1.0 with all four terms at 1', () => {
        const { score } = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, momentum: 1, lowVol: 1,
        });
        expect(score).toBeCloseTo(1.0);
    });

    it('weights fractional momentum/lowVol correctly', () => {
        // 0.6 + 0.3*0.5 + 0.1*0.25 = 0.775
        const { score } = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, momentum: 0.5, lowVol: 0.25,
        });
        expect(score).toBeCloseTo(0.6 + 0.3 * 0.5 + 0.1 * 0.25);
    });
});

// --- newPositionBreadth: diagnostic field, never weighted ---

describe('computeScore — newPositionBreadth (diagnostic only, not weighted)', () => {
    // FROZEN-WEIGHT REGRESSION: supplying newHolderCountActive must NOT change score.
    it('score is byte-for-byte identical when newHolderCountActive is supplied vs absent', () => {
        const base = computeScore({
            holderCountActive: 3, totalActiveFunds: 10, rank: 5, momentum: 0.6, lowVol: 0.4,
        });
        const withNew = computeScore({
            holderCountActive: 3, totalActiveFunds: 10, rank: 5, momentum: 0.6, lowVol: 0.4,
            newHolderCountActive: 2,
        });
        expect(withNew.score).toBe(base.score);
    });

    it('score is unchanged when newHolderCountActive is 0', () => {
        const base = computeScore({ holderCountActive: 2, totalActiveFunds: 5, rank: null });
        const with0 = computeScore({
            holderCountActive: 2, totalActiveFunds: 5, rank: null,
            newHolderCountActive: 0,
        });
        expect(with0.score).toBe(base.score);
    });

    it('score is unchanged even at maximum newHolderCountActive', () => {
        const base = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, momentum: 1, lowVol: 1,
        });
        const withMax = computeScore({
            holderCountActive: 3, totalActiveFunds: 3, rank: 1, momentum: 1, lowVol: 1,
            newHolderCountActive: 100,
        });
        // Score must remain 1.0 — newPositionBreadth is not a weight.
        expect(withMax.score).toBe(base.score);
    });

    // newPositionBreadth value = clamp([0,1]) of newHolderCountActive / totalActiveFunds.
    it('newPositionBreadth = newHolderCountActive / totalActiveFunds (fractional)', () => {
        const { components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 10, rank: null,
            newHolderCountActive: 4,
        });
        expect(components.newPositionBreadth).toBeCloseTo(4 / 10);
    });

    it('newPositionBreadth clamps to 1 when newHolderCountActive >= totalActiveFunds', () => {
        const { components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 5, rank: null,
            newHolderCountActive: 10,
        });
        expect(components.newPositionBreadth).toBe(1);
    });

    it('newPositionBreadth clamps to 0 when newHolderCountActive is 0', () => {
        const { components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 5, rank: null,
            newHolderCountActive: 0,
        });
        expect(components.newPositionBreadth).toBe(0);
    });

    it('newPositionBreadth is null when newHolderCountActive is null (no MV)', () => {
        const { components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 10, rank: null,
            newHolderCountActive: null,
        });
        expect(components.newPositionBreadth).toBeNull();
    });

    it('newPositionBreadth is null when newHolderCountActive is absent (omitted field)', () => {
        const { components } = computeScore({
            holderCountActive: 3, totalActiveFunds: 10, rank: null,
        });
        expect(components.newPositionBreadth).toBeNull();
    });

    it('newPositionBreadth is null when totalActiveFunds <= 0 (guard against divide-by-zero)', () => {
        const { components } = computeScore({
            holderCountActive: 0, totalActiveFunds: 0, rank: null,
            newHolderCountActive: 5,
        });
        // Must be null, not NaN or Infinity.
        expect(components.newPositionBreadth).toBeNull();
    });

    it('null newPositionBreadth never changes score regardless of other inputs', () => {
        // Exhaustive check: adding null newHolderCountActive never affects score.
        const inputs = [
            { holderCountActive: 1, totalActiveFunds: 5, rank: null },
            { holderCountActive: 5, totalActiveFunds: 5, rank: 1, momentum: 0.5, lowVol: 0.5 },
            { holderCountActive: 0, totalActiveFunds: 0, rank: null },
        ];
        for (const inp of inputs) {
            const base = computeScore(inp);
            const withNull = computeScore({ ...inp, newHolderCountActive: null });
            expect(withNull.score).toBe(base.score);
        }
    });
});
