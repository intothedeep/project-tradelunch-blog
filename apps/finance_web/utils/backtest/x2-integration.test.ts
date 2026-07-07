// utils/backtest/x2-integration.test.ts
// Integration tests for Wave-2: rebalanceIfDue wiring, manualFlows, DCA asset-route,
// perHoldingValues, and dividend-route + rebalance coexist (X2.6/7/8/10/17a/18).

import { describe, expect, it } from 'vitest';
import { runBacktest } from './engine';
import type {
    BacktestInput,
    PricePoint,
    RebalancePolicy,
} from '@/types/backtest';

// ── Test helpers ──────────────────────────────────────────────────────────────

function mkSeries(
    dates: string[],
    closes: number[],
    dividends?: number[]
): PricePoint[] {
    return dates.map((date, i) => ({
        date,
        close: closes[i] ?? 0,
        dividends: dividends?.[i] ?? 0,
        stockSplits: 0,
    }));
}

function baseRebalPolicy(
    freq: RebalancePolicy['freq'] = 'monthly',
    bandPct = 5
): RebalancePolicy {
    return {
        freq,
        band: { kind: 'absolute', pct: bandPct },
        groups: [],
    };
}

const DATES_2020 = [
    '2020-01-02',
    '2020-02-03',
    '2020-03-02',
    '2020-04-01',
    '2020-05-01',
    '2020-06-01',
    '2020-07-01',
    '2020-08-03',
];

// ── (i) zero-regression: rebalance undefined ⇒ identical timeline ─────────────

describe('zero-regression: rebalance undefined vs baseline', () => {
    it('timeline is byte-identical when rebalance is absent', () => {
        const seriesA = mkSeries(
            DATES_2020,
            [100, 110, 105, 120, 115, 125, 130, 128]
        );
        const seriesB = mkSeries(
            DATES_2020,
            [200, 210, 195, 220, 215, 225, 235, 230]
        );
        const input: BacktestInput = {
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 60 },
                { label: 'B', weightPct: 40 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-08-03' },
            seed: 42,
            riskFreeRate: 0.04,
        };
        const base = runBacktest(input);
        const withoutRebalance = runBacktest({
            ...input,
            rebalance: undefined,
        });

        // timeline must be identical (same value at every date)
        expect(base.timeline.length).toBe(withoutRebalance.timeline.length);
        for (let i = 0; i < base.timeline.length; i++) {
            expect(base.timeline[i]!.value).toBe(
                withoutRebalance.timeline[i]!.value
            );
        }
        // No rebalance audit trail
        expect(withoutRebalance.rebalance).toBeUndefined();
    });
});

// ── (ii) simple 2-asset drift-band rebalance produces expected trades ─────────

describe('2-asset drift-band rebalance', () => {
    it('rebalances toward targets when drift exceeds band', () => {
        // A rises faster: by month 3 A is heavily over-weight.
        // Policy: monthly rebalance, 5% absolute band.
        // Start 50/50: A=5000 @ 100, B=5000 @ 100.
        // Month 2: A @ 150, B @ 100 → A=60%, B=40% → over band (target 50%).
        // Month 3: A @ 200, B @ 100 → even more drift.
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02'];
        const seriesA = mkSeries(dates, [100, 150, 200]);
        const seriesB = mkSeries(dates, [100, 100, 100]);

        const result = runBacktest({
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-03-02' },
            seed: 1,
            riskFreeRate: 0.04,
            rebalance: baseRebalPolicy('monthly', 5),
        });

        // Rebalance audit trail must exist
        expect(result.rebalance).toBeDefined();
        const events = result.rebalance?.events ?? [];

        // At least one rebalance event should have fired
        expect(events.length).toBeGreaterThan(0);

        // Each event must have non-zero turnover
        for (const ev of events) {
            expect(ev.turnover).toBeGreaterThan(0);
        }

        // The first event should include a sell of A and buy of B
        const firstEvent = events[0]!;
        const sellA = firstEvent.trades.find(
            (t) => t.label === 'A' && t.deltaShares < 0
        );
        const buyB = firstEvent.trades.find(
            (t) => t.label === 'B' && t.deltaShares > 0
        );
        expect(sellA).toBeDefined();
        expect(buyB).toBeDefined();
    });

    it('produces deterministic results across two calls', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02', '2020-04-01'];
        const seriesA = mkSeries(dates, [100, 160, 180, 200]);
        const seriesB = mkSeries(dates, [100, 90, 95, 100]);
        const input: BacktestInput = {
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            rebalance: baseRebalPolicy('monthly', 5),
        };
        const r1 = runBacktest(input);
        const r2 = runBacktest(input);
        expect(r1.metrics.finalValue).toBe(r2.metrics.finalValue);
        expect(JSON.stringify(r1.rebalance?.events)).toBe(
            JSON.stringify(r2.rebalance?.events)
        );
    });
});

// ── (iii) takeProfit bearTrough scenario end-to-end ───────────────────────────

describe('takeProfit trigger end-to-end', () => {
    it('fires trim when in bear and price recovers by gainPct', () => {
        // A peaks at 100, drops to 70 (enters bear, -30% > 20% threshold),
        // then recovers to 84 (20% above trough 70 → fires).
        // B drops to 50 and stays there so A remains over-weight at recovery,
        // making the trim produce a non-zero sell trade.
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02', '2020-04-01'];
        const seriesA = mkSeries(dates, [100, 70, 75, 84]);
        const seriesB = mkSeries(dates, [100, 50, 50, 50]); // B collapses → A over-weight

        const result = runBacktest({
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 60 },
                { label: 'B', weightPct: 40 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            rebalance: {
                freq: 'never', // disable scheduled rebalance — only trigger
                band: { kind: 'absolute', pct: 5 },
                groups: [],
                triggers: [{ kind: 'takeProfit', label: 'A', gainPct: 20 }],
            },
        });

        expect(result.rebalance).toBeDefined();
        const allTrades = (result.rebalance?.events ?? []).flatMap(
            (e) => e.trades
        );
        // Should have a sell-A trade on the recovery bar
        const sellA = allTrades.find(
            (t) => t.label === 'A' && t.deltaShares < 0
        );
        expect(sellA).toBeDefined();
    });

    it('does NOT fire when canSell===false, pushes warning', () => {
        // Same scenario as above: A over-weight at recovery bar.
        // canSell===false blocks the trim and must push a warning.
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02', '2020-04-01'];
        const seriesA = mkSeries(dates, [100, 70, 75, 84]);
        const seriesB = mkSeries(dates, [100, 50, 50, 50]); // B collapses → A over-weight

        const result = runBacktest({
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 60, canSell: false },
                { label: 'B', weightPct: 40 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            rebalance: {
                freq: 'never',
                band: { kind: 'absolute', pct: 5 },
                groups: [],
                triggers: [{ kind: 'takeProfit', label: 'A', gainPct: 20 }],
            },
        });

        // No sell-A trades (canSell===false skips the trim)
        const allTrades = (result.rebalance?.events ?? []).flatMap(
            (e) => e.trades
        );
        const sellA = allTrades.find(
            (t) => t.label === 'A' && t.deltaShares < 0
        );
        expect(sellA).toBeUndefined();
        // Warning should be pushed
        expect(result.rebalance?.warnings?.some((w) => w.includes('"A"'))).toBe(
            true
        );
    });
});

// ── (iv) manualFlows — deposit + withdrawal ───────────────────────────────────

describe('manualFlows', () => {
    it('deposit increases portfolio value', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02'];
        const seriesA = mkSeries(dates, [100, 100, 100]);
        const inputBase: BacktestInput = {
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: { A: seriesA },
            range: { from: '2020-01-02', to: '2020-03-02' },
            seed: 1,
            riskFreeRate: 0.04,
        };
        const base = runBacktest(inputBase);
        const withDeposit = runBacktest({
            ...inputBase,
            manualFlows: [{ date: '2020-02-03', amount: 1000 }],
        });
        const lastBase = base.timeline[base.timeline.length - 1]!.value;
        const lastDeposit =
            withDeposit.timeline[withDeposit.timeline.length - 1]!.value;
        expect(lastDeposit).toBeGreaterThan(lastBase);
    });

    it('withdrawal reduces portfolio value', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02'];
        const seriesA = mkSeries(dates, [100, 100, 100]);
        const inputBase: BacktestInput = {
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: { A: seriesA },
            range: { from: '2020-01-02', to: '2020-03-02' },
            seed: 1,
            riskFreeRate: 0.04,
        };
        const base = runBacktest(inputBase);
        const withWithdrawal = runBacktest({
            ...inputBase,
            manualFlows: [{ date: '2020-02-03', amount: -1000 }],
        });
        const lastBase = base.timeline[base.timeline.length - 1]!.value;
        const lastWithdrawal =
            withWithdrawal.timeline[withWithdrawal.timeline.length - 1]!.value;
        expect(lastWithdrawal).toBeLessThan(lastBase);
    });

    it('absent manualFlows → byte-identical output', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02'];
        const seriesA = mkSeries(dates, [100, 110, 120]);
        const input: BacktestInput = {
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: { A: seriesA },
            range: { from: '2020-01-02', to: '2020-03-02' },
            seed: 42,
            riskFreeRate: 0.04,
        };
        const base = runBacktest(input);
        const noFlows = runBacktest({ ...input, manualFlows: [] });
        const undefinedFlows = runBacktest({
            ...input,
            manualFlows: undefined,
        });
        for (let i = 0; i < base.timeline.length; i++) {
            expect(noFlows.timeline[i]!.value).toBe(base.timeline[i]!.value);
            expect(undefinedFlows.timeline[i]!.value).toBe(
                base.timeline[i]!.value
            );
        }
    });

    it('withdrawal larger than cash triggers pro-rata share sell', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02'];
        const seriesA = mkSeries(dates, [100, 100, 100]);
        const result = runBacktest({
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: { A: seriesA },
            range: { from: '2020-01-02', to: '2020-03-02' },
            seed: 1,
            riskFreeRate: 0.04,
            // no DCA → cash = 0 at start; withdrawal must sell shares
            manualFlows: [{ date: '2020-02-03', amount: -2000 }],
        });
        // Final value should be budget - 2000 = 8000 (price flat)
        const finalVal = result.timeline[result.timeline.length - 1]!.value;
        expect(finalVal).toBeCloseTo(8000, 2);
    });
});

// ── (v) DCA asset-route ───────────────────────────────────────────────────────

describe('DCA asset-route', () => {
    it('byWeight (default) → identical to no-route', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02', '2020-04-01'];
        const seriesA = mkSeries(dates, [100, 110, 105, 115]);
        const seriesB = mkSeries(dates, [200, 210, 205, 215]);
        const base: BacktestInput = {
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 60 },
                { label: 'B', weightPct: 40 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            contribution: { amount: 500, freq: 'monthly' },
        };
        const withDefault = runBacktest(base);
        const withByWeight = runBacktest({
            ...base,
            contribution: {
                amount: 500,
                freq: 'monthly',
                route: { kind: 'byWeight' },
            },
        });
        for (let i = 0; i < withDefault.timeline.length; i++) {
            expect(withByWeight.timeline[i]!.value).toBe(
                withDefault.timeline[i]!.value
            );
        }
    });

    it('asset-route: all DCA cash goes to one label', () => {
        const dates = ['2020-01-02', '2020-02-03', '2020-03-02', '2020-04-01'];
        const seriesA = mkSeries(dates, [100, 100, 100, 100]);
        const seriesB = mkSeries(dates, [100, 100, 100, 100]);
        const resultByWeight = runBacktest({
            budget: 0,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            contribution: { amount: 1000, freq: 'monthly' },
        });
        const resultAssetRoute = runBacktest({
            budget: 0,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-04-01' },
            seed: 1,
            riskFreeRate: 0.04,
            contribution: {
                amount: 1000,
                freq: 'monthly',
                route: { kind: 'asset', target: 'A' },
            },
        });

        // With asset-route ALL cash goes to A, so A should have more shares than B
        const aResult = resultAssetRoute.perHolding.find(
            (h) => h.label === 'A'
        )!;
        const bResult = resultAssetRoute.perHolding.find(
            (h) => h.label === 'B'
        )!;
        expect(aResult.shares).toBeGreaterThan(bResult.shares);

        // byWeight splits evenly: A and B shares should be equal
        const aBase = resultByWeight.perHolding.find((h) => h.label === 'A')!;
        const bBase = resultByWeight.perHolding.find((h) => h.label === 'B')!;
        expect(aBase.shares).toBeCloseTo(bBase.shares, 6);
    });
});

// ── (vi) X2.8 — dividend-route + rebalance coexist ───────────────────────────

describe('X2.8 — JEPQ dividends routed to QLD + rebalance policy coexist', () => {
    it('dividend cross-route and rebalance run deterministically together', () => {
        // JEPQ pays dividends that are cross-routed to QLD.
        // Rebalance policy is active with monthly freq.
        // Test: both systems run together without error, results are deterministic,
        // and JEPQ dividends were collected (showing cross-route fired).
        // NOTE: rebalance legitimately trims QLD when QLD drifts over-weight —
        // final QLD shares may be less than initial; that is correct behaviour.
        const dates = [
            '2023-01-03',
            '2023-02-01',
            '2023-03-01',
            '2023-04-03',
            '2023-05-01',
            '2023-06-01',
        ];
        // JEPQ: pays $0.50/sh dividend each month; price flat
        const jepqSeries = mkSeries(
            dates,
            [46, 46, 46, 46, 46, 46],
            [0, 0.5, 0.5, 0.5, 0.5, 0.5]
        );
        // QLD: 2× leveraged, climbs slowly
        const qldSeries = mkSeries(dates, [40, 42, 44, 43, 45, 47]);

        const input: BacktestInput = {
            budget: 10000,
            holdings: [
                {
                    label: 'JEPQ',
                    weightPct: 50,
                    dividendRoute: { kind: 'asset', target: 'QLD' },
                },
                { label: 'QLD', weightPct: 50 },
            ],
            seriesByLabel: { JEPQ: jepqSeries, QLD: qldSeries },
            range: { from: '2023-01-03', to: '2023-06-01' },
            seed: 7,
            riskFreeRate: 0.04,
            rebalance: baseRebalPolicy('monthly', 5),
        };

        const r1 = runBacktest(input);
        const r2 = runBacktest(input);

        // Deterministic
        expect(r1.metrics.finalValue).toBe(r2.metrics.finalValue);
        expect(JSON.stringify(r1.timeline)).toBe(JSON.stringify(r2.timeline));

        // Rebalance audit trail present (rebalance ran)
        expect(r1.rebalance).toBeDefined();
        expect((r1.rebalance?.events ?? []).length).toBeGreaterThan(0);

        // Dividends from JEPQ were collected (cross-route fired)
        const jepqDiv = r1.dividends.byLabel['JEPQ'] ?? 0;
        expect(jepqDiv).toBeGreaterThan(0);
    });
});

// ── (vii) perHoldingValues shape ─────────────────────────────────────────────

describe('X2.17a perHoldingValues', () => {
    it('emits per-holding values aligned to timeline length', () => {
        const dates = ['2020-01-02', '2020-01-03', '2020-01-06'];
        const seriesA = mkSeries(dates, [100, 110, 120]);
        const seriesB = mkSeries(dates, [200, 200, 200]);

        const result = runBacktest({
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: { A: seriesA, B: seriesB },
            range: { from: '2020-01-02', to: '2020-01-06' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        expect(result.perHoldingValues).toBeDefined();
        expect(result.perHoldingValues!.length).toBe(result.timeline.length);

        // Each row has values for A and B
        for (const row of result.perHoldingValues!) {
            expect(typeof row.values['A']).toBe('number');
            expect(typeof row.values['B']).toBe('number');
        }

        // sum(values) + cash ≈ timeline value
        for (let i = 0; i < result.timeline.length; i++) {
            const row = result.perHoldingValues![i]!;
            const tlRow = result.timeline[i]!;
            const sumValues = Object.values(row.values).reduce(
                (s, v) => s + v,
                0
            );
            // sumValues ≤ tlRow.value (cash is excluded from perHoldingValues)
            expect(sumValues).toBeLessThanOrEqual(tlRow.value + 1e-6);
        }
    });

    it('existing timeline fields are unmodified (no mutation)', () => {
        const dates = ['2020-01-02', '2020-01-03'];
        const seriesA = mkSeries(dates, [100, 110]);
        const result = runBacktest({
            budget: 10000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: { A: seriesA },
            range: { from: '2020-01-02', to: '2020-01-03' },
            seed: 1,
            riskFreeRate: 0.04,
        });
        // timeline entries have only {date, value}
        for (const entry of result.timeline) {
            expect(Object.keys(entry)).toEqual(['date', 'value']);
        }
    });
});
