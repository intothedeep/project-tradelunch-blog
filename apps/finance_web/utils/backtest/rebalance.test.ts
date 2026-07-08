// utils/backtest/rebalance.test.ts
// Unit tests for pure action helpers in rebalance.ts (X2.5-pieces + R2 gate).

import { describe, expect, it } from 'vitest';
import { computePortfolioSnapshot, computeDriftBandTrades } from './rebalance';
import { rebalanceIfDue } from './rebalance';
import type {
    Holding,
    PricePoint,
    RebalancePolicy,
    RebalanceState,
} from '@/types/backtest';

const EPS = 1e-9;

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeBar(close: number, date = '2024-01-15'): PricePoint {
    return { date, close, dividends: 0, stockSplits: 1 };
}

function makeDateIndexes(
    labels: string[],
    closes: number[],
    date = '2024-01-15'
): Map<string, Map<string, PricePoint>> {
    const di = new Map<string, Map<string, PricePoint>>();
    labels.forEach((lbl, i) => {
        di.set(lbl, new Map([[date, makeBar(closes[i]!, date)]]));
    });
    return di;
}

function makeMultiDateIndexes(
    labels: string[],
    dateCloses: { date: string; closes: number[] }[]
): Map<string, Map<string, PricePoint>> {
    const di = new Map<string, Map<string, PricePoint>>();
    for (const lbl of labels) di.set(lbl, new Map());
    for (const { date, closes } of dateCloses) {
        labels.forEach((lbl, i) => {
            di.get(lbl)!.set(lbl, makeBar(closes[i]!, date));
            // Re-key by date string
        });
    }
    // Rebuild with correct date keys
    const di2 = new Map<string, Map<string, PricePoint>>();
    for (const lbl of labels) di2.set(lbl, new Map());
    for (const { date, closes } of dateCloses) {
        labels.forEach((lbl, i) => {
            di2.get(lbl)!.set(date, makeBar(closes[i]!, date));
        });
    }
    return di2;
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

function makeState(): RebalanceState {
    return {
        assets: new Map(),
        lastRebalanceDate: null,
        events: [],
        warnings: [],
        armedRebalance: false,
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

// ── Schedule gate (R2) — 2-axis model ─────────────────────────────────────────

describe('rebalanceIfDue — scheduleGate 2-axis (R2)', () => {
    const holdings: Holding[] = [
        { label: 'A', weightPct: 50 },
        { label: 'B', weightPct: 50 },
    ];

    // Shared setup: A drifts to ~70% on Feb-01
    function makeSetup() {
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [
                { date: '2024-01-01', closes: [100, 100] }, // A=50%, B=50%
                { date: '2024-02-01', closes: [140, 60] }, // A≈70%, B≈30%
                { date: '2024-03-01', closes: [100, 100] }, // A=50%, B=50%
            ]
        );
        const shares = new Map([
            ['A', 5],
            ['B', 5],
        ]); // A=500, B=500, nav=1000
        return { di, shares };
    }

    // ── Combo 1: schedule + immediate (old 'gated') ──────────────────────────

    it('schedule+immediate: skips when condition NOT met on due date, fires when met', () => {
        const { di, shares } = makeSetup();
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: 'A', pct: 70, dir: '>=' }],
            },
        };
        const state = makeState();

        // Bar 1: Jan-01 — due, but A≈50% (not >= 70%) → skip
        rebalanceIfDue('2024-01-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(0);
        expect(state.lastRebalanceDate).toBe('2024-01-01');

        // Bar 2: Feb-01 — due, A≈70% (condition met) → FIRE
        rebalanceIfDue('2024-02-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1);
        expect(state.lastRebalanceDate).toBe('2024-02-01');
    });

    // ── Combo 2: always + immediate ──────────────────────────────────────────

    it('always+immediate: fires immediately on any bar when condition met', () => {
        // Three bars: Jan-01 (due, A=50% not met), Feb-01 (NOT due, A=70% met → fire NOW)
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [
                { date: '2024-01-01', closes: [100, 100] }, // A=50%
                { date: '2024-01-15', closes: [140, 60] }, // A≈70% — NOT a due date (quarterly)
                { date: '2024-04-01', closes: [100, 100] }, // A=50% — due date
            ]
        );
        const shares = new Map([
            ['A', 5],
            ['B', 5],
        ]);
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'immediate',
                conditions: [{ label: 'A', pct: 70, dir: '>=' }],
            },
        };
        const state = makeState();

        // Jan-01: due (Q1 first bar), A=50% not met → no event
        rebalanceIfDue('2024-01-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(0);

        // Jan-15: NOT due (still Q1), A=70% met → FIRE immediately
        rebalanceIfDue('2024-01-15', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1);
        // lastRebalanceDate not updated (not a scheduled date)
        expect(state.lastRebalanceDate).toBe('2024-01-01');

        // Apr-01: due (Q2), A=50% condition not met → no additional event
        rebalanceIfDue('2024-04-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1); // still 1
    });

    // ── Combo 3: always + nextSchedule (old 'armNext') ───────────────────────

    it('always+nextSchedule: arms on breach on any bar, fires on NEXT due date, then disarms', () => {
        // date1: Jan-01 (due), A=50% (not breached)
        // date2: Feb-01 (not due), A=75% (breach → arm)
        // date3: Apr-01 (due), A=70% (armed → FIRE, disarm)
        // date4: Jul-01 (due), A=50% (not armed → skip)
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [
                { date: '2024-01-01', closes: [100, 100] }, // A=50%
                { date: '2024-02-01', closes: [150, 50] }, // A=75% — NOT due
                { date: '2024-04-01', closes: [120, 80] }, // A=60% < 70% — due (Q2); fire armed but don't re-arm
                { date: '2024-07-01', closes: [100, 100] }, // A=50% — due (Q3)
            ]
        );
        const shares = new Map([
            ['A', 5],
            ['B', 5],
        ]);
        const policy: RebalancePolicy = {
            freq: 'quarterly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'always',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'A', pct: 70, dir: '>=' }],
            },
        };
        const state = makeState();

        // Jan-01: due, A=50% not breached → no arm, no fire
        rebalanceIfDue('2024-01-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(0);
        expect(state.armedRebalance).toBe(false);
        expect(state.lastRebalanceDate).toBe('2024-01-01');

        // Feb-01: NOT due, A=75% (breach) → arm
        rebalanceIfDue('2024-02-01', shares, 0, state, policy, holdings, di);
        expect(state.armedRebalance).toBe(true);
        expect(state.events.length).toBe(0); // no trade yet

        // Apr-01: due (Q2), armed → FIRE and disarm; A=60% so condition not re-met
        rebalanceIfDue('2024-04-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1);
        expect(state.armedRebalance).toBe(false); // condition not met at Apr-01 prices
        expect(state.lastRebalanceDate).toBe('2024-04-01');

        // Jul-01: due (Q3), not armed → skip
        rebalanceIfDue('2024-07-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1); // still only 1 event
    });

    // ── Combo 4: schedule + nextSchedule ─────────────────────────────────────

    it('schedule+nextSchedule: arms on due date if met, fires on the FOLLOWING due date', () => {
        // Jan-01: due, A=70% (condition met) → arm (NOT fire yet)
        // Feb-01: due, A=65% (not met, but armed) → FIRE (shares OOB at these prices)
        // Mar-01: due, not armed, A<70% → skip
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [
                { date: '2024-01-01', closes: [140, 60] }, // A≈70% — due; arm
                { date: '2024-02-01', closes: [130, 70] }, // A=65% — due; fire arm
                { date: '2024-03-01', closes: [100, 100] }, // A=50% — due; no arm
            ]
        );
        const shares = new Map([
            ['A', 5],
            ['B', 5],
        ]); // A=700, B=300, nav=1000 at Jan-01
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'nextSchedule',
                conditions: [{ label: 'A', pct: 70, dir: '>=' }],
            },
        };
        const state = makeState();

        // Jan-01: due, A=70% met → arm (no immediate fire)
        rebalanceIfDue('2024-01-01', shares, 0, state, policy, holdings, di);
        expect(state.armedRebalance).toBe(true);
        expect(state.events.length).toBe(0);
        expect(state.lastRebalanceDate).toBe('2024-01-01');

        // Feb-01: due, A=65% (not met), but armed → FIRE (shares still 5A/5B → 650/350 OOB)
        rebalanceIfDue('2024-02-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1);
        expect(state.armedRebalance).toBe(false); // A=65% < 70% → no re-arm
        expect(state.lastRebalanceDate).toBe('2024-02-01');

        // Mar-01: due, not armed, A=50% not met → skip
        rebalanceIfDue('2024-03-01', shares, 0, state, policy, holdings, di);
        expect(state.events.length).toBe(1); // still 1
    });

    // ── scheduleGate REPLACES drift-band ─────────────────────────────────────

    it('scheduleGate REPLACES drift-band (no double rebalance on same due date)', () => {
        // Drift-band alone would fire; but with gate, only gate logic runs.
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [{ date: '2024-02-01', closes: [140, 60] }] // A≈70% — would breach drift-band too
        );
        const shares = new Map([
            ['A', 5],
            ['B', 5],
        ]);
        const policy: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: 'A', pct: 70, dir: '>=' }],
            },
        };
        const state = makeState();
        state.lastRebalanceDate = '2024-01-15';

        rebalanceIfDue('2024-02-01', shares, 0, state, policy, holdings, di);
        // Should produce exactly ONE rebalance event (gate fires), not two
        expect(state.events.length).toBe(1);
    });

    // ── Backward-compat: no scheduleGate ─────────────────────────────────────

    it('backward-compat: policy WITHOUT scheduleGate produces same behavior as before', () => {
        // Policy without gate: drift-band on monthly schedule
        const di = makeMultiDateIndexes(
            ['A', 'B'],
            [
                { date: '2024-01-01', closes: [70, 30] }, // A=70%, B=30% out-of-band
                { date: '2024-02-01', closes: [70, 30] },
            ]
        );
        const sharesGate = new Map([
            ['A', 10],
            ['B', 10],
        ]); // A=700, B=300
        const sharesNoGate = new Map([
            ['A', 10],
            ['B', 10],
        ]);

        const policyNoGate: RebalancePolicy = {
            freq: 'monthly',
            band: { kind: 'absolute', pct: 5 },
            groups: [],
        };

        const stateNoGate = makeState();
        rebalanceIfDue(
            '2024-01-01',
            sharesNoGate,
            0,
            stateNoGate,
            policyNoGate,
            holdings,
            di
        );

        // Should rebalance on first bar (lastRebalanceDate=null → due)
        expect(stateNoGate.events.length).toBe(1);
        expect(stateNoGate.lastRebalanceDate).toBe('2024-01-01');

        // With scheduleGate present (schedule+immediate), condition met → fires too
        const stateWithGate = makeState();
        const policyWithGate: RebalancePolicy = {
            ...policyNoGate,
            scheduleGate: {
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: 'A', pct: 60, dir: '>=' }],
            },
        };
        rebalanceIfDue(
            '2024-01-01',
            sharesGate,
            0,
            stateWithGate,
            policyWithGate,
            holdings,
            di
        );
        // A=70% >= 60% → condition met → fires
        expect(stateWithGate.events.length).toBe(1);

        // Confirm no-gate path is deterministic across two calls
        const sharesNoGate2 = new Map([
            ['A', 10],
            ['B', 10],
        ]);
        const stateNoGate2 = makeState();
        rebalanceIfDue(
            '2024-01-01',
            sharesNoGate2,
            0,
            stateNoGate2,
            policyNoGate,
            holdings,
            di
        );
        expect(stateNoGate2.events.length).toBe(stateNoGate.events.length);
    });
});
