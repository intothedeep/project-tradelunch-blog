// __tests__/helpers/politicalScore.test.ts
// Purpose: unit tests for the pure computePoliticalScore helper.
// No I/O — no mocks needed.

import { computePoliticalScore } from '../../src/helpers/politicalScore';

describe('computePoliticalScore — null / zero guard', () => {
    it('returns null when tradedByCount is null', () => {
        expect(computePoliticalScore({ tradedByCount: null, buyMembers: 3, sellMembers: 0 })).toBeNull();
    });

    it('returns null when tradedByCount is 0', () => {
        expect(computePoliticalScore({ tradedByCount: 0, buyMembers: 0, sellMembers: 0 })).toBeNull();
    });

    it('returns null even when buy/sell members are non-zero but tradedByCount is null', () => {
        expect(computePoliticalScore({ tradedByCount: null, buyMembers: 5, sellMembers: 2 })).toBeNull();
    });
});

describe('computePoliticalScore — breadth saturation at count >= 5', () => {
    // At count=5, breadth=1; above 5, breadth stays 1.
    it('breadth saturates at 1 when tradedByCount === 5', () => {
        // All-buy: consensus=1; score = (0.55*1 + 0.30*1) / 0.85 = 1
        const score = computePoliticalScore({ tradedByCount: 5, buyMembers: 5, sellMembers: 0 });
        expect(score).toBeCloseTo(1.0);
    });

    it('breadth saturates at 1 when tradedByCount > 5', () => {
        const score10 = computePoliticalScore({ tradedByCount: 10, buyMembers: 10, sellMembers: 0 });
        const score5  = computePoliticalScore({ tradedByCount: 5,  buyMembers: 5,  sellMembers: 0 });
        // Both should reach max — breadth is capped.
        expect(score10).toBeCloseTo(score5 as number);
    });

    it('breadth is < 1 when tradedByCount < 5', () => {
        // count=2 → breadth=0.4; all-buy → consensus=1
        // score = (0.55*0.4 + 0.30*1) / 0.85 = (0.22 + 0.30) / 0.85 = 0.52/0.85
        const score = computePoliticalScore({ tradedByCount: 2, buyMembers: 2, sellMembers: 0 });
        expect(score).toBeCloseTo((0.55 * 0.4 + 0.30 * 1) / 0.85);
    });
});

describe('computePoliticalScore — consensus for all-buy vs split', () => {
    it('all-buy gives consensus=1 (max agreement)', () => {
        // count=1, buy=1, sell=0 → breadth=0.2, consensus=1
        const score = computePoliticalScore({ tradedByCount: 1, buyMembers: 1, sellMembers: 0 });
        expect(score).toBeCloseTo((0.55 * 0.2 + 0.30 * 1) / 0.85);
    });

    it('all-sell gives consensus=1 (sell skew is also directional agreement)', () => {
        const score = computePoliticalScore({ tradedByCount: 1, buyMembers: 0, sellMembers: 1 });
        expect(score).toBeCloseTo((0.55 * 0.2 + 0.30 * 1) / 0.85);
    });

    it('50/50 split gives lower consensus than all-buy', () => {
        // count=4, buy=2, sell=2 → consensus=0.5
        const split   = computePoliticalScore({ tradedByCount: 4, buyMembers: 2, sellMembers: 2 });
        const allBuy  = computePoliticalScore({ tradedByCount: 4, buyMembers: 4, sellMembers: 0 });
        expect(split as number).toBeLessThan(allBuy as number);
    });

    it('treats null buy/sell members as 0', () => {
        const score = computePoliticalScore({ tradedByCount: 2, buyMembers: null, sellMembers: null });
        // breadth=0.4, consensus=0/2=0 → (0.55*0.4 + 0)/0.85
        expect(score).toBeCloseTo((0.55 * 0.4) / 0.85);
    });
});

describe('computePoliticalScore — renormalized range [0,1]', () => {
    it('minimum non-null score is > 0 (count=1, full split)', () => {
        const score = computePoliticalScore({ tradedByCount: 1, buyMembers: 0, sellMembers: 0 });
        // breadth=0.2, consensus=0 → (0.55*0.2)/0.85 > 0
        expect(score as number).toBeGreaterThan(0);
    });

    it('maximum score is 1.0 (count>=5, all-buy)', () => {
        const score = computePoliticalScore({ tradedByCount: 5, buyMembers: 5, sellMembers: 0 });
        expect(score).toBeCloseTo(1.0);
    });

    it('score is always in [0,1] for various inputs', () => {
        const cases: Parameters<typeof computePoliticalScore>[0][] = [
            { tradedByCount: 1, buyMembers: 1, sellMembers: 0 },
            { tradedByCount: 3, buyMembers: 2, sellMembers: 1 },
            { tradedByCount: 4, buyMembers: 0, sellMembers: 4 },
            { tradedByCount: 10, buyMembers: 7, sellMembers: 3 },
        ];
        for (const c of cases) {
            const s = computePoliticalScore(c) as number;
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThanOrEqual(1);
        }
    });
});

describe('computePoliticalScore — determinism', () => {
    it('returns the same value for identical inputs (called twice)', () => {
        const input = { tradedByCount: 3, buyMembers: 2, sellMembers: 1 };
        expect(computePoliticalScore(input)).toBe(computePoliticalScore(input));
    });
});
