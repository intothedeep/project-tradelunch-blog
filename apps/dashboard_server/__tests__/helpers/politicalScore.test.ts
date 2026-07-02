// __tests__/helpers/politicalScore.test.ts
// Purpose: unit tests for the pure computePoliticalScore helper.
// No I/O — no mocks needed.
//
// Formula: 0.55*breadth + 0.30*consensus + 0.15*notionalTier
//   breadth      = min(1, tradedByCount / 5)
//   consensus    = max(buyMembers, sellMembers) / max(1, tradedByCount)
//   notionalTier = 0 (<250k or null) | 0.5 (250k–5M) | 1 (≥5M)

import { computePoliticalScore } from '../../src/helpers/politicalScore';

// Shorthand: omit notional (defaults to null tier=0) unless the test is specifically about notional.
function score(
    tradedByCount: number | null,
    buyMembers: number | null,
    sellMembers: number | null,
    notional: number | null = null
) {
    return computePoliticalScore({ tradedByCount, buyMembers, sellMembers, notional });
}

describe('computePoliticalScore — null / zero guard', () => {
    it('returns null when tradedByCount is null', () => {
        expect(score(null, 3, 0)).toBeNull();
    });

    it('returns null when tradedByCount is 0', () => {
        expect(score(0, 0, 0)).toBeNull();
    });

    it('returns null even when buy/sell members are non-zero but tradedByCount is null', () => {
        expect(score(null, 5, 2)).toBeNull();
    });

    it('returns null even with large notional when tradedByCount is null', () => {
        expect(score(null, 5, 0, 10_000_000)).toBeNull();
    });
});

describe('computePoliticalScore — notionalTier boundaries', () => {
    // breadth=0.2 (count=1), consensus=1 (all-buy), notional varies
    it('notionalTier=0 when notional is null', () => {
        const s = score(1, 1, 0, null) as number;
        // 0.55*0.2 + 0.30*1 + 0.15*0 = 0.11 + 0.30 = 0.41
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 0);
    });

    it('notionalTier=0 when notional < 250_000', () => {
        const s = score(1, 1, 0, 249_999) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 0);
    });

    it('notionalTier=0.5 when notional === 250_000 (lower boundary)', () => {
        const s = score(1, 1, 0, 250_000) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 0.5);
    });

    it('notionalTier=0.5 when notional is mid-range (1_000_000)', () => {
        const s = score(1, 1, 0, 1_000_000) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 0.5);
    });

    it('notionalTier=0.5 when notional just below 5_000_000', () => {
        const s = score(1, 1, 0, 4_999_999) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 0.5);
    });

    it('notionalTier=1 when notional === 5_000_000 (upper boundary)', () => {
        const s = score(1, 1, 0, 5_000_000) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 1);
    });

    it('notionalTier=1 when notional > 5_000_000', () => {
        const s = score(1, 1, 0, 50_000_000) as number;
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1 + 0.15 * 1);
    });

    it('null notional → tier=0; score still computes from counts (NOT null)', () => {
        // Politician data present → score must be non-null even with notional=null.
        expect(score(2, 2, 0, null)).not.toBeNull();
    });
});

describe('computePoliticalScore — breadth saturation at count >= 5', () => {
    it('breadth saturates at 1 when tradedByCount === 5 (notional null)', () => {
        // breadth=1, consensus=1, tier=0 → 0.55+0.30+0 = 0.85
        const s = score(5, 5, 0) as number;
        expect(s).toBeCloseTo(0.55 * 1 + 0.30 * 1 + 0.15 * 0);
    });

    it('breadth saturates at 1 when tradedByCount > 5', () => {
        const s10 = score(10, 10, 0);
        const s5  = score(5,  5,  0);
        // Both should be equal (breadth capped at 1, same notional=null tier).
        expect(s10).toBeCloseTo(s5 as number);
    });

    it('breadth is < 1 when tradedByCount < 5', () => {
        // count=2 → breadth=0.4; all-buy → consensus=1; notional null → tier=0
        const s = score(2, 2, 0) as number;
        expect(s).toBeCloseTo(0.55 * 0.4 + 0.30 * 1 + 0.15 * 0);
    });
});

describe('computePoliticalScore — consensus for all-buy vs split', () => {
    it('all-buy gives consensus=1 (max agreement)', () => {
        // count=1, buy=1, sell=0, notional=null → 0.55*0.2 + 0.30*1 + 0 = 0.41
        const s = score(1, 1, 0);
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1);
    });

    it('all-sell gives consensus=1 (sell skew is also directional agreement)', () => {
        const s = score(1, 0, 1);
        expect(s).toBeCloseTo(0.55 * 0.2 + 0.30 * 1);
    });

    it('50/50 split gives lower consensus than all-buy', () => {
        const split  = score(4, 2, 2);
        const allBuy = score(4, 4, 0);
        expect(split as number).toBeLessThan(allBuy as number);
    });

    it('treats null buy/sell members as 0', () => {
        const s = score(2, null, null) as number;
        // breadth=0.4, consensus=0, tier=0 → 0.55*0.4 + 0 + 0 = 0.22
        expect(s).toBeCloseTo(0.55 * 0.4);
    });
});

describe('computePoliticalScore — full formula [0,1] range', () => {
    it('minimum non-null score > 0 (count=1, no buy/sell, notional=null)', () => {
        const s = score(1, 0, 0, null) as number;
        // 0.55*0.2 + 0 + 0 = 0.11 > 0
        expect(s).toBeGreaterThan(0);
    });

    it('maximum score is 1.0 (count>=5, all-buy, notional>=5M)', () => {
        const s = score(5, 5, 0, 5_000_000) as number;
        // 0.55*1 + 0.30*1 + 0.15*1 = 1.0
        expect(s).toBeCloseTo(1.0);
    });

    it('score without notional caps at 0.85 (count>=5, all-buy, notional=null)', () => {
        const s = score(5, 5, 0, null) as number;
        expect(s).toBeCloseTo(0.85);
    });

    it('score is always in [0,1] for various inputs', () => {
        const cases: [number, number | null, number | null, number | null][] = [
            [1, 1, 0, null],
            [1, 1, 0, 250_000],
            [1, 1, 0, 5_000_000],
            [3, 2, 1, 1_000_000],
            [4, 0, 4, null],
            [10, 7, 3, 6_000_000],
            [5, 5, 0, 0],
        ];
        for (const [count, buy, sell, notional] of cases) {
            const s = score(count, buy, sell, notional) as number;
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThanOrEqual(1 + 1e-9);
        }
    });
});

describe('computePoliticalScore — determinism', () => {
    it('returns the same value for identical inputs (called twice)', () => {
        const input = { tradedByCount: 3, buyMembers: 2, sellMembers: 1, notional: 300_000 };
        expect(computePoliticalScore(input)).toBe(computePoliticalScore(input));
    });

    it('is deterministic with null notional', () => {
        const input = { tradedByCount: 3, buyMembers: 2, sellMembers: 1, notional: null };
        expect(computePoliticalScore(input)).toBe(computePoliticalScore(input));
    });
});
