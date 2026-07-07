// utils/backtest/triggers.test.ts
// Unit tests for advanceRunState, updateAssetState, and evaluateTriggers (X2.9).

import { describe, expect, it } from 'vitest';
import {
    advanceRunState,
    updateAssetState,
    evaluateTriggers,
} from './triggers';
import type {
    AssetRunState,
    Holding,
    PricePoint,
    RebalancePolicy,
    RebalanceState,
} from '@/types/backtest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBar(close: number, date = '2024-01-15'): PricePoint {
    return { date, close, dividends: 0, stockSplits: 1 };
}

function makeDI(
    labels: string[],
    closes: number[],
    date = '2024-01-15'
): Map<string, Map<string, PricePoint>> {
    const di = new Map<string, Map<string, PricePoint>>();
    labels.forEach((lbl, i) =>
        di.set(lbl, new Map([[date, makeBar(closes[i]!, date)]]))
    );
    return di;
}

function makeState(): RebalanceState {
    return {
        assets: new Map(),
        lastRebalanceDate: null,
        events: [],
        warnings: [],
    };
}

function makePolicy(
    triggers: RebalancePolicy['triggers'] = []
): RebalancePolicy {
    return {
        freq: 'monthly',
        band: { kind: 'absolute', pct: 5 },
        groups: [],
        triggers,
    };
}

// ── updateAssetState ──────────────────────────────────────────────────────────

describe('updateAssetState', () => {
    it('enter bear when close ≤ peak × (1 − threshold)', () => {
        const s: AssetRunState = {
            peak: 100,
            trough: 100,
            lastBuyPrice: 0,
            inBear: false,
        };
        updateAssetState(s, 79, 20); // 79 ≤ 80 (20% below peak)
        expect(s.inBear).toBe(true);
        expect(s.trough).toBe(79);
    });

    it('does NOT enter bear above threshold', () => {
        const s: AssetRunState = {
            peak: 100,
            trough: 100,
            lastBuyPrice: 0,
            inBear: false,
        };
        updateAssetState(s, 85, 20); // 85 > 80
        expect(s.inBear).toBe(false);
        expect(s.peak).toBe(100); // peak unchanged
    });

    it('tracks min trough while inBear', () => {
        const s: AssetRunState = {
            peak: 100,
            trough: 80,
            lastBuyPrice: 0,
            inBear: true,
        };
        updateAssetState(s, 70, 20);
        expect(s.trough).toBe(70);
        updateAssetState(s, 75, 20);
        expect(s.trough).toBe(70); // didn't go lower
    });

    it('exit bear on new peak', () => {
        const s: AssetRunState = {
            peak: 100,
            trough: 60,
            lastBuyPrice: 0,
            inBear: true,
        };
        updateAssetState(s, 100, 20); // exactly at peak
        expect(s.inBear).toBe(false);
        expect(s.peak).toBe(100);
        expect(s.trough).toBe(100);
    });

    it('updates peak in normal (non-bear) mode', () => {
        const s: AssetRunState = {
            peak: 100,
            trough: 100,
            lastBuyPrice: 0,
            inBear: false,
        };
        updateAssetState(s, 120, 20);
        expect(s.peak).toBe(120);
    });
});

// ── advanceRunState ───────────────────────────────────────────────────────────

describe('advanceRunState', () => {
    it('first bar: initialises peak=trough=close, inBear=false', () => {
        const state = makeState();
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const di = makeDI(['A'], [100]);
        advanceRunState(state, holdings, di, '2024-01-15');
        const s = state.assets.get('A');
        expect(s?.peak).toBe(100);
        expect(s?.trough).toBe(100);
        expect(s?.inBear).toBe(false);
    });

    it('missing bar → HOLD (no state change)', () => {
        const state = makeState();
        state.assets.set('A', {
            peak: 100,
            trough: 80,
            lastBuyPrice: 0,
            inBear: true,
        });
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const di = makeDI([], []); // no bar for A
        advanceRunState(state, holdings, di, '2024-01-15');
        const s = state.assets.get('A')!;
        expect(s.peak).toBe(100); // unchanged
        expect(s.inBear).toBe(true); // unchanged
    });

    it('full scenario: peak → bear entry → lower trough → recovery → bear exit', () => {
        const state = makeState();
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];

        // Bar 1: initialise at 100
        advanceRunState(
            state,
            holdings,
            makeDI(['A'], [100], '2024-01-01'),
            '2024-01-01'
        );
        let s = state.assets.get('A')!;
        expect(s.peak).toBe(100);
        expect(s.inBear).toBe(false);

        // Bar 2: 79 → enter bear (≤ 80 = 100×0.8)
        advanceRunState(
            state,
            holdings,
            makeDI(['A'], [79], '2024-01-02'),
            '2024-01-02'
        );
        s = state.assets.get('A')!;
        expect(s.inBear).toBe(true);
        expect(s.trough).toBe(79);

        // Bar 3: 70 → lower trough
        advanceRunState(
            state,
            holdings,
            makeDI(['A'], [70], '2024-01-03'),
            '2024-01-03'
        );
        s = state.assets.get('A')!;
        expect(s.trough).toBe(70);

        // Bar 4: 100 → new peak → exit bear
        advanceRunState(
            state,
            holdings,
            makeDI(['A'], [100], '2024-01-04'),
            '2024-01-04'
        );
        s = state.assets.get('A')!;
        expect(s.inBear).toBe(false);
        expect(s.peak).toBe(100);
        expect(s.trough).toBe(100);
    });
});

// ── evaluateTriggers ──────────────────────────────────────────────────────────

describe('evaluateTriggers', () => {
    it('no triggers → empty actions', () => {
        const state = makeState();
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const di = makeDI(['A'], [100]);
        const policy = makePolicy([]);
        const actions = evaluateTriggers(
            policy,
            state,
            new Map([['A', 10]]),
            0,
            holdings,
            di,
            '2024-01-15',
            new Map([['A', 1]])
        );
        expect(actions).toHaveLength(0);
    });

    it('first bar → no fire for conditional triggers (no state)', () => {
        const state = makeState();
        const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
        const di = makeDI(['A'], [60]);
        const policy = makePolicy([
            { kind: 'takeProfit', label: 'A', gainPct: 20 },
            { kind: 'weightCap', label: 'A', pct: 80 },
        ]);
        // No asset state yet → takeProfit skips, weightCap still evaluates
        const actions = evaluateTriggers(
            policy,
            state,
            new Map([['A', 10]]),
            0,
            holdings,
            di,
            '2024-01-15',
            new Map([['A', 1]])
        );
        // weightCap: A=100% of nav=600, cap=80% → fires trim
        // takeProfit: no assetState → skips
        const snap = actions.find((a) => a.op === 'trim' && a.label === 'A');
        expect(snap).toBeDefined();
    });

    describe('weightCap', () => {
        it('fires trim when weight > cap', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 60 },
                { label: 'B', weightPct: 40 },
            ];
            const di = makeDI(['A', 'B'], [80, 20]);
            const policy = makePolicy([
                { kind: 'weightCap', label: 'A', pct: 60 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.6],
                    ['B', 0.4],
                ])
            );
            expect(
                actions.some((a) => a.op === 'trim' && a.label === 'A')
            ).toBe(true);
        });

        it('does NOT fire when canSell===false', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 100, canSell: false },
            ];
            const di = makeDI(['A'], [100]);
            const policy = makePolicy([
                { kind: 'weightCap', label: 'A', pct: 50 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 10]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.length).toBe(0);
        });
    });

    describe('takeProfit', () => {
        it('fires when inBear and close ≥ trough × (1 + gainPct/100)', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 70,
                lastBuyPrice: 0,
                inBear: true,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            // gainPct=20 → threshold = 70×1.2 = 84
            const di = makeDI(['A'], [85]);
            const policy = makePolicy([
                { kind: 'takeProfit', label: 'A', gainPct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(
                actions.some((a) => a.op === 'trim' && a.label === 'A')
            ).toBe(true);
        });

        it('does NOT fire when not inBear', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 100,
                lastBuyPrice: 0,
                inBear: false,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            const di = makeDI(['A'], [200]); // well above trough
            const policy = makePolicy([
                { kind: 'takeProfit', label: 'A', gainPct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.length).toBe(0);
        });

        it('whipsaw re-arm: fires once, then bumps trough so next identical close does NOT fire', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 70,
                lastBuyPrice: 0,
                inBear: true,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            const di = makeDI(['A'], [85]);
            const policy = makePolicy([
                { kind: 'takeProfit', label: 'A', gainPct: 20 },
            ]);
            const targets = new Map([['A', 1]]);

            // First call fires.
            const a1 = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                targets
            );
            expect(a1.some((a) => a.op === 'trim' && a.label === 'A')).toBe(
                true
            );

            // trough bumped to 85 by whipsaw re-arm; threshold now 85×1.2=102.
            // Same close=85 → should NOT fire.
            const a2 = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                targets
            );
            expect(a2.some((a) => a.op === 'trim' && a.label === 'A')).toBe(
                false
            );
        });

        it('does NOT fire for canSell===false label', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 70,
                lastBuyPrice: 0,
                inBear: true,
            });
            const holdings: Holding[] = [
                { label: 'A', weightPct: 100, canSell: false },
            ];
            const di = makeDI(['A'], [90]);
            const policy = makePolicy([
                { kind: 'takeProfit', label: 'A', gainPct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.length).toBe(0);
        });
    });

    describe('driftBand (detection)', () => {
        it('fires snapAll when a label is out-of-band', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ];
            // A=80%, B=20% vs target 50/50 → 30% drift > 5%
            const di = makeDI(['A', 'B'], [80, 20]);
            const policy = makePolicy([
                { kind: 'driftBand', band: { kind: 'absolute', pct: 5 } },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.5],
                    ['B', 0.5],
                ])
            );
            expect(actions.some((a) => a.op === 'snapAll')).toBe(true);
        });

        it('does NOT fire when all labels are within band', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ];
            // A=51%, B=49% vs target 50/50 → 1% drift < 5%
            const di = makeDI(['A', 'B'], [51, 49]);
            const policy = makePolicy([
                { kind: 'driftBand', band: { kind: 'absolute', pct: 5 } },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.5],
                    ['B', 0.5],
                ])
            );
            expect(actions.some((a) => a.op === 'snapAll')).toBe(false);
        });
    });

    describe('buyDip', () => {
        it('fires buy when close ≤ peak × (1 − dropPct/100)', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 70,
                lastBuyPrice: 0,
                inBear: true,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            const di = makeDI(['A'], [70]); // 30% below peak
            const policy = makePolicy([
                { kind: 'buyDip', label: 'A', dropPct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.some((a) => a.op === 'buy' && a.label === 'A')).toBe(
                true
            );
        });

        it('does NOT fire above dip threshold', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 90,
                lastBuyPrice: 0,
                inBear: false,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            const di = makeDI(['A'], [85]); // 15% below peak, dropPct=20
            const policy = makePolicy([
                { kind: 'buyDip', label: 'A', dropPct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.some((a) => a.op === 'buy')).toBe(false);
        });
    });

    describe('weightFloor', () => {
        it('fires buy when weight < floor', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 80 },
                { label: 'B', weightPct: 20 },
            ];
            // B=10%, floor=20%
            const di = makeDI(['A', 'B'], [90, 10]);
            const policy = makePolicy([
                { kind: 'weightFloor', label: 'B', pct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.8],
                    ['B', 0.2],
                ])
            );
            expect(actions.some((a) => a.op === 'buy' && a.label === 'B')).toBe(
                true
            );
        });

        it('does NOT fire when weight ≥ floor', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 80 },
                { label: 'B', weightPct: 20 },
            ];
            const di = makeDI(['A', 'B'], [80, 20]);
            const policy = makePolicy([
                { kind: 'weightFloor', label: 'B', pct: 20 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.8],
                    ['B', 0.2],
                ])
            );
            expect(actions.some((a) => a.op === 'buy' && a.label === 'B')).toBe(
                false
            );
        });
    });

    describe('missing bar → HOLD', () => {
        it('label with missing bar is excluded from trigger evaluation', () => {
            const state = makeState();
            state.assets.set('A', {
                peak: 100,
                trough: 50,
                lastBuyPrice: 0,
                inBear: true,
            });
            const holdings: Holding[] = [{ label: 'A', weightPct: 100 }];
            // No bar for A on this date
            const di = new Map<string, Map<string, PricePoint>>();
            const policy = makePolicy([
                { kind: 'takeProfit', label: 'A', gainPct: 5 },
                { kind: 'weightCap', label: 'A', pct: 50 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([['A', 1]]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([['A', 1]])
            );
            expect(actions.length).toBe(0);
        });
    });

    describe('priority order', () => {
        it('weightCap fires before weightFloor in same result set', () => {
            const state = makeState();
            const holdings: Holding[] = [
                { label: 'A', weightPct: 80 },
                { label: 'B', weightPct: 20 },
            ];
            // A over cap, B under floor
            const di = makeDI(['A', 'B'], [90, 10]);
            const policy = makePolicy([
                { kind: 'weightFloor', label: 'B', pct: 20 },
                { kind: 'weightCap', label: 'A', pct: 70 },
            ]);
            const actions = evaluateTriggers(
                policy,
                state,
                new Map([
                    ['A', 10],
                    ['B', 10],
                ]),
                0,
                holdings,
                di,
                '2024-01-15',
                new Map([
                    ['A', 0.8],
                    ['B', 0.2],
                ])
            );
            const ops = actions.map((a) => a.op);
            const capIdx = ops.indexOf('trim');
            const floorIdx = ops.indexOf('buy');
            // weightCap (trim) must appear before weightFloor (buy)
            expect(capIdx).toBeLessThan(floorIdx);
        });
    });
});
