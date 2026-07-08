// utils/backtest/dividends.test.ts
// Purpose: XE.2 — dividend routing unit tests.
// Covers: cross-asset routing, 2-phase cycle correctness, cash fallback,
//         legacy drip back-compat, source attribution, URL codec back-compat.

import { describe, it, expect } from 'vitest';
import { applyDividends, resolveRoute } from '@/utils/backtest/dividends';
import { runBacktest } from '@/utils/backtest/engine';
import type { PricePoint, Holding } from '@/types/backtest';

// ── helpers ───────────────────────────────────────────────────────────────────

function mkBar(
    date: string,
    close: number,
    dividends = 0,
    stockSplits = 0
): PricePoint {
    return { date, close, dividends, stockSplits };
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

// ── 1. Cross-asset routing: JEPQ dividend → VOO ───────────────────────────────

describe('cross-asset routing (JEPQ → VOO)', () => {
    const DATE = '2024-01-15';
    const jepqHolding: Holding = {
        label: 'JEPQ',
        weightPct: 60,
        dividendRoute: { kind: 'asset', target: 'VOO' },
    };
    const vooHolding: Holding = {
        label: 'VOO',
        weightPct: 40,
        dividendRoute: { kind: 'cash' },
    };
    const holdings = [jepqHolding, vooHolding];

    const dateIndexes = buildIndex([
        ['JEPQ', [mkBar(DATE, 55.0, 0.4)]],
        ['VOO', [mkBar(DATE, 470.0, 0)]],
    ]);
    const shares = new Map([
        ['JEPQ', 100], // 100 shares × $0.40 = $40 dividend
        ['VOO', 50],
    ]);
    const sharesBefore = new Map(shares);

    const result = applyDividends(DATE, holdings, dateIndexes, shares);

    it('JEPQ shares remain unchanged (dividend sourced from JEPQ, not reinvested there)', () => {
        expect(shares.get('JEPQ')).toBe(sharesBefore.get('JEPQ'));
    });

    it('VOO shares increase by divCash / close_VOO', () => {
        const divCash = 100 * 0.4; // $40
        const expectedExtra = divCash / 470.0;
        const vooAfter = shares.get('VOO') ?? 0;
        expect(vooAfter).toBeCloseTo(50 + expectedExtra, 8);
    });

    it('cashDelta is 0 (fully reinvested into VOO)', () => {
        expect(result.cashDelta).toBe(0);
    });

    it('event has cash=0 and routedTo=VOO', () => {
        const ev = result.events[0];
        expect(ev).toBeDefined();
        expect(ev!.cash).toBe(0);
        expect(ev!.routedTo).toBe('VOO');
        expect(ev!.label).toBe('JEPQ');
    });

    it('dividendAmounts attributes to source JEPQ', () => {
        const divCash = 100 * 0.4;
        expect(result.dividendAmounts.get('JEPQ')).toBeCloseTo(divCash, 8);
        expect(result.dividendAmounts.has('VOO')).toBe(false);
    });
});

// ── 2. Two-phase cycle: A→B and B→A same-day ─────────────────────────────────

describe('2-phase cycle: A routes to B, B routes to A (same date)', () => {
    const DATE = '2024-03-01';
    const aHolding: Holding = {
        label: 'A',
        weightPct: 50,
        dividendRoute: { kind: 'asset', target: 'B' },
    };
    const bHolding: Holding = {
        label: 'B',
        weightPct: 50,
        dividendRoute: { kind: 'asset', target: 'A' },
    };
    const holdings = [aHolding, bHolding];

    // A: 200 shares × $1 div; B: 100 shares × $2 div
    const dateIndexes = buildIndex([
        ['A', [mkBar(DATE, 10.0, 1.0)]],
        ['B', [mkBar(DATE, 20.0, 2.0)]],
    ]);
    const shares = new Map([
        ['A', 200],
        ['B', 100],
    ]);

    const result = applyDividends(DATE, holdings, dateIndexes, shares);

    it('A receives B dividend using B ex-date shares (100 × $2 = $200 / close_A $10 = 20 extra A)', () => {
        // B routes to A: divCash_B = 100 × 2 = $200; → $200 / 10 = 20 extra A shares
        const expectedAExtra = (100 * 2.0) / 10.0;
        expect(shares.get('A')).toBeCloseTo(200 + expectedAExtra, 8);
    });

    it('B receives A dividend using A ex-date shares (200 × $1 = $200 / close_B $20 = 10 extra B)', () => {
        // A routes to B: divCash_A = 200 × 1 = $200; → $200 / 20 = 10 extra B shares
        const expectedBExtra = (200 * 1.0) / 20.0;
        expect(shares.get('B')).toBeCloseTo(100 + expectedBExtra, 8);
    });

    it('cashDelta is 0 (both fully cross-reinvested)', () => {
        expect(result.cashDelta).toBe(0);
    });

    it('2 events emitted, one per source', () => {
        expect(result.events).toHaveLength(2);
    });
});

// ── 3. Fallback: target missing → cash ────────────────────────────────────────

describe('cash fallback — target missing from dateIndexes', () => {
    const DATE = '2024-06-01';
    const holding: Holding = {
        label: 'X',
        weightPct: 100,
        dividendRoute: { kind: 'asset', target: 'MISSING' },
    };
    const dateIndexes = buildIndex([
        ['X', [mkBar(DATE, 100.0, 5.0)]],
        // 'MISSING' not present
    ]);
    const shares = new Map([['X', 10]]);
    const result = applyDividends(DATE, [holding], dateIndexes, shares);

    it('falls back to cash when target label is absent', () => {
        const divCash = 10 * 5.0;
        expect(result.cashDelta).toBeCloseTo(divCash, 8);
    });

    it('event cash equals divCash and routedTo is cash', () => {
        expect(result.events[0]?.cash).toBeCloseTo(50, 8);
        expect(result.events[0]?.routedTo).toBe('cash');
    });
});

describe('cash fallback — target close ≤ 0', () => {
    const DATE = '2024-06-01';
    const holding: Holding = {
        label: 'X',
        weightPct: 100,
        dividendRoute: { kind: 'asset', target: 'Y' },
    };
    const dateIndexes = buildIndex([
        ['X', [mkBar(DATE, 100.0, 3.0)]],
        ['Y', [mkBar(DATE, 0, 0)]], // close = 0 → fallback
    ]);
    const shares = new Map([['X', 10]]);
    const result = applyDividends(DATE, [holding], dateIndexes, shares);

    it('falls back to cash when target close is 0', () => {
        expect(result.cashDelta).toBeCloseTo(30, 8);
    });
});

// ── 4. Legacy drip back-compat ────────────────────────────────────────────────

describe('legacy drip:true resolves to same-asset', () => {
    it('resolveRoute({drip:true}) returns {kind:"same"}', () => {
        const h: Holding = { label: 'A', weightPct: 100, drip: true };
        expect(resolveRoute(h)).toEqual({ kind: 'same' });
    });

    it('resolveRoute({drip:false}) returns {kind:"cash"}', () => {
        const h: Holding = { label: 'A', weightPct: 100, drip: false };
        expect(resolveRoute(h)).toEqual({ kind: 'cash' });
    });

    it('dividendRoute takes precedence over drip', () => {
        const h: Holding = {
            label: 'A',
            weightPct: 100,
            drip: false, // legacy says cash
            dividendRoute: { kind: 'same' }, // explicit says same — wins
        };
        expect(resolveRoute(h)).toEqual({ kind: 'same' });
    });

    it('engine: drip:true produces identical result to dividendRoute:{kind:same}', () => {
        const series = [
            mkBar('2020-01-01', 100, 0),
            mkBar('2020-01-02', 100, 5),
            mkBar('2020-01-03', 110, 0),
        ];

        const r1 = runBacktest({
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100, drip: true }],
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2020-01-03' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        const r2 = runBacktest({
            budget: 10000,
            holdings: [
                {
                    label: 'A',
                    weightPct: 100,
                    dividendRoute: { kind: 'same' },
                },
            ],
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2020-01-03' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        expect(r1.metrics.finalValue).toBeCloseTo(r2.metrics.finalValue, 8);
    });
});

// ── 5. Source attribution in dividendAmounts ──────────────────────────────────

describe('dividendAmounts attributes to source regardless of route', () => {
    const DATE = '2024-02-01';
    const holding: Holding = {
        label: 'SRC',
        weightPct: 100,
        dividendRoute: { kind: 'asset', target: 'TGT' },
    };
    const dateIndexes = buildIndex([
        ['SRC', [mkBar(DATE, 50.0, 2.0)]],
        ['TGT', [mkBar(DATE, 100.0, 0)]],
    ]);
    const shares = new Map([
        ['SRC', 30],
        ['TGT', 10],
    ]);
    const result = applyDividends(DATE, [holding], dateIndexes, shares);

    it('dividendAmounts["SRC"] equals shares × perShare', () => {
        expect(result.dividendAmounts.get('SRC')).toBeCloseTo(30 * 2.0, 8);
    });

    it('dividendAmounts does not contain TGT (TGT is target, not source)', () => {
        expect(result.dividendAmounts.has('TGT')).toBe(false);
    });
});

// ── 6. URL codec: decodeRoute logic (via resolveRoute contract) ───────────────

describe('URL codec legacy back-compat (resolveRoute contract)', () => {
    it('legacy drip:true == {kind:"same"} (URL :1 decode path)', () => {
        // Legacy URL: "QQQ:100:1" → decodeHoldings yields {drip:true}
        // Engine uses resolveRoute → {kind:'same'} → same-asset DRIP
        expect(
            resolveRoute({ label: 'QQQ', weightPct: 100, drip: true })
        ).toEqual({ kind: 'same' });
    });

    it('legacy drip:false == {kind:"cash"} (URL :0 decode path)', () => {
        expect(
            resolveRoute({ label: 'QQQ', weightPct: 100, drip: false })
        ).toEqual({ kind: 'cash' });
    });

    it('new dividendRoute:{kind:same} encodes to same via resolveRoute', () => {
        const h: Holding = {
            label: 'QQQ',
            weightPct: 60,
            dividendRoute: { kind: 'same' },
        };
        expect(resolveRoute(h)).toEqual({ kind: 'same' });
    });

    it('cross-asset dividendRoute encodes to {kind:asset,target}', () => {
        const h: Holding = {
            label: 'JEPQ',
            weightPct: 40,
            dividendRoute: { kind: 'asset', target: 'VOO' },
        };
        expect(resolveRoute(h)).toEqual({ kind: 'asset', target: 'VOO' });
    });
});

// ── 7. monthlyStats compatibility: cross-asset routed dividend → cash:0 ───────

describe('monthlyStats cash-column compatibility', () => {
    it('cross-asset routed event has cash=0 (not counted as cash payout)', () => {
        // monthlyStats sums schedule.cash for the dividend column.
        // A cross-asset routed dividend must have cash:0 (reinvested elsewhere).
        const DATE = '2024-05-01';
        const holding: Holding = {
            label: 'JEPQ',
            weightPct: 100,
            dividendRoute: { kind: 'asset', target: 'VOO' },
        };
        const dateIndexes = buildIndex([
            ['JEPQ', [mkBar(DATE, 55.0, 1.0)]],
            ['VOO', [mkBar(DATE, 470.0, 0)]],
        ]);
        const shares = new Map([
            ['JEPQ', 50],
            ['VOO', 20],
        ]);
        const result = applyDividends(DATE, [holding], dateIndexes, shares);

        expect(result.events[0]?.cash).toBe(0);
    });
});
