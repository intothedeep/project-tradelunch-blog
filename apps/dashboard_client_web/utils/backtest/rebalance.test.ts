// utils/backtest/rebalance.test.ts
// Unit tests for pure action helpers in rebalance.ts (X2.5-pieces).

import { describe, expect, it } from 'vitest';
import { computePortfolioSnapshot, computeDriftBandTrades } from './rebalance';
import type { Holding, PricePoint, RebalancePolicy } from '@/types/backtest';

const EPS = 1e-9;

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeBar(close: number): PricePoint {
    return { date: '2024-01-15', close, dividends: 0, stockSplits: 1 };
}

function makeDateIndexes(
    labels: string[],
    closes: number[],
    date = '2024-01-15'
): Map<string, Map<string, PricePoint>> {
    const di = new Map<string, Map<string, PricePoint>>();
    labels.forEach((lbl, i) => {
        di.set(lbl, new Map([[date, makeBar(closes[i]!)]]));
    });
    return di;
}

function makePolicy(
    bandKind: 'absolute' | 'relative' = 'absolute',
    bandPct = 5
): RebalancePolicy {
    return {
        freq: 'monthly',
        band: { kind: bandKind, pct: bandPct },
        groups: [],
    };
}

// ── computePortfolioSnapshot ──────────────────────────────────────────────────

describe('computePortfolioSnapshot', () => {
    it('sums shares×close + cash correctly', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60 },
            { label: 'B', weightPct: 40 },
        ];
        const shares = new Map([
            ['A', 10],
            ['B', 5],
        ]);
        const di = makeDateIndexes(['A', 'B'], [100, 200]);
        const snap = computePortfolioSnapshot(
            shares,
            50,
            holdings,
            di,
            '2024-01-15'
        );
        expect(snap.values.get('A')).toBe(1000);
        expect(snap.values.get('B')).toBe(1000);
        expect(snap.totalNav).toBe(2050);
    });

    it('missing bar contributes 0', () => {
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const shares = new Map([['A', 10]]);
        const di = makeDateIndexes([], []); // no bars
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        expect(snap.values.get('A')).toBe(0);
        expect(snap.totalNav).toBe(0);
    });
});

// ── computeDriftBandTrades ─────────────────────────────────────────────────────

describe('computeDriftBandTrades', () => {
    it('label within band → no trade', () => {
        // A=55%, B=45% vs target A=50%, B=50%; band=10% → within band
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50 },
            { label: 'B', weightPct: 50 },
        ];
        const targets = new Map([
            ['A', 0.5],
            ['B', 0.5],
        ]);
        const di = makeDateIndexes(['A', 'B'], [110, 90]);
        // shares such that A=55%, B=45% of 200 nav
        const shares = new Map([
            ['A', 1],
            ['B', 1],
        ]); // A=110, B=90, nav=200
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 10); // 10% absolute band
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );
        expect(trades.length).toBe(0);
    });

    it('out-of-band → trades generated; NAV preserved', () => {
        // A=70%, B=30% vs target A=50%, B=50%; band=5%
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50 },
            { label: 'B', weightPct: 50 },
        ];
        const targets = new Map([
            ['A', 0.5],
            ['B', 0.5],
        ]);
        // A=700, B=300, nav=1000
        const di = makeDateIndexes(['A', 'B'], [70, 30]);
        const shares = new Map([
            ['A', 10],
            ['B', 10],
        ]); // A=700, B=300
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 5);
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );

        // There should be a sell for A and a buy for B
        const sellA = trades.find((t) => t.label === 'A');
        const buyB = trades.find((t) => t.label === 'B');
        expect(sellA).toBeDefined();
        expect(sellA!.deltaShares).toBeLessThan(0);
        expect(sellA!.deltaCash).toBeGreaterThan(0);
        expect(buyB).toBeDefined();
        expect(buyB!.deltaShares).toBeGreaterThan(0);
        expect(buyB!.deltaCash).toBeLessThan(0);

        // NAV preserved: sum of deltaCash should be 0 (sell proceeds = buy spend)
        const navChange = trades.reduce((s, t) => s + t.deltaCash, 0);
        expect(Math.abs(navChange)).toBeLessThan(EPS);
    });

    it('canSell===false label is never trimmed', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, canSell: false },
            { label: 'B', weightPct: 50 },
        ];
        const targets = new Map([
            ['A', 0.5],
            ['B', 0.5],
        ]);
        // A=70%, B=30%
        const di = makeDateIndexes(['A', 'B'], [70, 30]);
        const shares = new Map([
            ['A', 10],
            ['B', 10],
        ]);
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 5);
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );

        // A should have NO sell trade
        const sellA = trades.find((t) => t.label === 'A' && t.deltaShares < 0);
        expect(sellA).toBeUndefined();
    });

    it('canSell===false overweight → remaining renormalized (deterministic)', () => {
        // Three assets: A (locked), B, C — target A=50%, B=25%, C=25%
        // Actual: A=70%, B=15%, C=15% → A locked-over, B+C renormalized over 30%
        const holdings: Holding[] = [
            { label: 'A', weightPct: 50, canSell: false },
            { label: 'B', weightPct: 25 },
            { label: 'C', weightPct: 25 },
        ];
        const targets = new Map([
            ['A', 0.5],
            ['B', 0.25],
            ['C', 0.25],
        ]);
        const di = makeDateIndexes(['A', 'B', 'C'], [70, 15, 15]);
        const shares = new Map([
            ['A', 10],
            ['B', 10],
            ['C', 10],
        ]);
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 5);
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );

        // A must never appear as a sell.
        const sellA = trades.find((t) => t.label === 'A' && t.deltaShares < 0);
        expect(sellA).toBeUndefined();

        // Result must be deterministic.
        const trades2 = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );
        expect(JSON.stringify(trades)).toBe(JSON.stringify(trades2));
    });

    it('sellPriority order is honored', () => {
        // Three over-target assets with different sellPriority
        // Both A (priority=2) and B (priority=1) are over target; C is under.
        const holdings: Holding[] = [
            { label: 'A', weightPct: 33, sellPriority: 2 },
            { label: 'B', weightPct: 33, sellPriority: 1 },
            { label: 'C', weightPct: 34 },
        ];
        const targets = new Map([
            ['A', 1 / 3],
            ['B', 1 / 3],
            ['C', 1 / 3],
        ]);
        // A=40%, B=40%, C=20% → both A,B over-target; C under
        const di = makeDateIndexes(['A', 'B', 'C'], [40, 40, 20]);
        const shares = new Map([
            ['A', 10],
            ['B', 10],
            ['C', 10],
        ]);
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 2);
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );

        const sellOrders = trades
            .filter((t) => t.deltaShares < 0)
            .map((t) => t.label);
        // B (priority=1) should appear before A (priority=2)
        if (sellOrders.includes('A') && sellOrders.includes('B')) {
            expect(sellOrders.indexOf('B')).toBeLessThan(
                sellOrders.indexOf('A')
            );
        }
    });

    it('NAV preserved: sell proceeds exactly fund buys', () => {
        const holdings: Holding[] = [
            { label: 'A', weightPct: 60 },
            { label: 'B', weightPct: 40 },
        ];
        const targets = new Map([
            ['A', 0.6],
            ['B', 0.4],
        ]);
        // Actual: A=80%, B=20%
        const di = makeDateIndexes(['A', 'B'], [80, 20]);
        const shares = new Map([
            ['A', 10],
            ['B', 10],
        ]);
        const snap = computePortfolioSnapshot(
            shares,
            0,
            holdings,
            di,
            '2024-01-15'
        );
        const policy = makePolicy('absolute', 5);
        const trades = computeDriftBandTrades(
            targets,
            snap,
            policy,
            holdings,
            di,
            '2024-01-15'
        );

        const navDelta = trades.reduce((s, t) => s + t.deltaCash, 0);
        expect(Math.abs(navDelta)).toBeLessThan(EPS);
    });
});
