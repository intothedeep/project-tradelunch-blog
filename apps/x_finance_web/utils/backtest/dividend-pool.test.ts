// utils/backtest/dividend-pool.test.ts
// Unit tests for reinvestDividendPool.

import { describe, it, expect } from 'vitest';
import { reinvestDividendPool } from '@/utils/backtest/dividend-pool';
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

const DATE = '2024-03-15';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('reinvestDividendPool', () => {
    it('pools cash by (divPct ?? weightPct)', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60, divPct: 70 },
            { label: 'B', weightPct: 40, divPct: 30 },
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

        const residual = reinvestDividendPool(
            DATE,
            1000,
            holdings,
            dateIndexes,
            shares,
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

    it('falls back to weightPct when divPct is undefined', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50 }, // no divPct
            { label: 'B', weightPct: 50 },
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

        const residual = reinvestDividendPool(
            DATE,
            1000,
            holdings,
            dateIndexes,
            shares,
            (lbl, usd) => buys.push([lbl, usd])
        );

        expect(residual).toBe(0);
        expect(shares.get('A')).toBeCloseTo(5);
        expect(shares.get('B')).toBeCloseTo(5);
        expect(buys).toEqual([
            ['A', 500],
            ['B', 500],
        ]);
    });

    it('accumulates residual when bar missing', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60, divPct: 50 },
            { label: 'B', weightPct: 40, divPct: 50 },
        ];
        const dateIndexes = buildIndex([
            ['A', [mkBar(DATE, 100)]],
            // B has no bar — residual
            ['B', []],
        ]);
        const shares = new Map<string, number>([
            ['A', 0],
            ['B', 0],
        ]);
        const buys: Array<[string, number]> = [];

        const residual = reinvestDividendPool(
            DATE,
            1000,
            holdings,
            dateIndexes,
            shares,
            (lbl, usd) => buys.push([lbl, usd])
        );

        expect(shares.get('A')).toBeCloseTo(5); // 500/100
        expect(residual).toBeCloseTo(500); // B portion undeployed
        expect(buys).toEqual([['A', 500]]);
    });

    it('iterates holdings in list order (deterministic)', () => {
        const holdings: Holding[] = [
            { label: 'X', weightPct: 30 },
            { label: 'Y', weightPct: 40 },
            { label: 'Z', weightPct: 30 },
        ];
        const dateIndexes = buildIndex([
            ['X', [mkBar(DATE, 10)]],
            ['Y', [mkBar(DATE, 10)]],
            ['Z', [mkBar(DATE, 10)]],
        ]);
        const shares = new Map<string, number>([
            ['X', 0],
            ['Y', 0],
            ['Z', 0],
        ]);
        const order: string[] = [];

        reinvestDividendPool(DATE, 1000, holdings, dateIndexes, shares, (lbl) =>
            order.push(lbl)
        );

        expect(order).toEqual(['X', 'Y', 'Z']);
    });
});
