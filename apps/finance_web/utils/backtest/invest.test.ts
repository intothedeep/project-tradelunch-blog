// utils/backtest/invest.test.ts
// Unit tests for investCash — byWeight, byDcaWeight, asset routes.

import { describe, it, expect } from 'vitest';
import { investCash } from '@/utils/backtest/invest';
import type { Holding, PricePoint } from '@/types/backtest';

// ── helpers ───────────────────────────────────────────────────────────────────

function mkBar(date: string, close: number): PricePoint {
    return { date, close, dividends: 0, stockSplits: 0 };
}

function buildIndex(
    entries: [string, PricePoint[]][]
): Map<string, Map<string, PricePoint>> {
    const out = new Map<string, Map<string, PricePoint>>();
    for (const [label, bars] of entries) {
        out.set(label, new Map(bars.map((b) => [b.date, b])));
    }
    return out;
}

const DATE = '2024-01-01';

// ── byWeight ──────────────────────────────────────────────────────────────────

describe('byWeight', () => {
    const holdings: Holding[] = [
        { label: 'A', weightPct: 60 },
        { label: 'B', weightPct: 40 },
    ];
    const dateIndexes = buildIndex([
        ['A', [mkBar(DATE, 100)]],
        ['B', [mkBar(DATE, 200)]],
    ]);
    const shares = new Map<string, number>([
        ['A', 0],
        ['B', 0],
    ]);

    it('splits by weightPct proportionally', () => {
        const residual = investCash(DATE, 1000, holdings, dateIndexes, shares);
        expect(residual).toBe(0);
        expect(shares.get('A')).toBeCloseTo(6); // 600/100
        expect(shares.get('B')).toBeCloseTo(2); // 400/200
    });
});

// ── byDcaWeight ───────────────────────────────────────────────────────────────

describe('byDcaWeight', () => {
    it('splits by dcaPct when both set', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60, dcaPct: 70 },
            { label: 'B', weightPct: 40, dcaPct: 30 },
        ];
        const dateIndexes = buildIndex([
            ['A', [mkBar(DATE, 100)]],
            ['B', [mkBar(DATE, 100)]],
        ]);
        const shares = new Map<string, number>([
            ['A', 0],
            ['B', 0],
        ]);
        const buys: Array<[string, number]> = [];
        const residual = investCash(
            DATE,
            1000,
            holdings,
            dateIndexes,
            shares,
            { kind: 'byDcaWeight' },
            (lbl, usd) => buys.push([lbl, usd])
        );
        expect(residual).toBe(0);
        expect(shares.get('A')).toBeCloseTo(7); // 700/100
        expect(shares.get('B')).toBeCloseTo(3); // 300/100
        expect(buys).toEqual([
            ['A', 700],
            ['B', 300],
        ]);
    });

    it('falls back to weightPct when dcaPct is undefined', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60 }, // no dcaPct → fallback
            { label: 'B', weightPct: 40, dcaPct: 40 },
        ];
        const dateIndexes = buildIndex([
            ['A', [mkBar(DATE, 100)]],
            ['B', [mkBar(DATE, 100)]],
        ]);
        const shares = new Map<string, number>([
            ['A', 0],
            ['B', 0],
        ]);
        const residual = investCash(DATE, 1000, holdings, dateIndexes, shares, {
            kind: 'byDcaWeight',
        });
        expect(residual).toBe(0);
        // A: 60% of 1000 = 600 shares at 100 = 6 shares
        expect(shares.get('A')).toBeCloseTo(6);
        // B: 40% of 1000 = 400 shares at 100 = 4 shares
        expect(shares.get('B')).toBeCloseTo(4);
    });

    it('accumulates residual when bar missing', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60, dcaPct: 50 },
            { label: 'B', weightPct: 40, dcaPct: 50 },
        ];
        const dateIndexes = buildIndex([
            ['A', [mkBar(DATE, 100)]],
            // B has no bar on DATE
            ['B', []],
        ]);
        const shares = new Map<string, number>([
            ['A', 0],
            ['B', 0],
        ]);
        const residual = investCash(DATE, 1000, holdings, dateIndexes, shares, {
            kind: 'byDcaWeight',
        });
        // A buys 500/100 = 5 shares; B contributes 500 residual
        expect(shares.get('A')).toBeCloseTo(5);
        expect(residual).toBeCloseTo(500);
    });

    it('onBuy records each portion', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, dcaPct: 60 },
            { label: 'B', weightPct: 50, dcaPct: 40 },
        ];
        const dateIndexes = buildIndex([
            ['A', [mkBar(DATE, 100)]],
            ['B', [mkBar(DATE, 100)]],
        ]);
        const shares = new Map<string, number>([
            ['A', 0],
            ['B', 0],
        ]);
        const recorded: Array<[string, number]> = [];
        investCash(
            DATE,
            1000,
            holdings,
            dateIndexes,
            shares,
            { kind: 'byDcaWeight' },
            (lbl, usd) => recorded.push([lbl, usd])
        );
        expect(recorded).toEqual([
            ['A', 600],
            ['B', 400],
        ]);
    });
});
