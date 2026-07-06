// utils/backtest/engine.test.ts
// Purpose: deterministic unit tests for the pure backtest engine (Phase X, X.6).
// All test series are hand-built; no I/O, no real market data.
// Note: noUncheckedIndexedAccess is enabled — uses non-null assertion (!) where
//       the index is structurally guaranteed to exist by test setup.

import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/utils/backtest/engine';
import { computeMaxDrawdown } from '@/utils/backtest/metrics';
import type { BacktestInput, PricePoint } from '@/types/backtest';

// ── Test helpers ─────────────────────────────────────────────────────────────

function mkSeries(
    dates: string[],
    closes: number[],
    dividends?: number[],
    stockSplits?: number[]
): PricePoint[] {
    return dates.map((date, i) => ({
        date,
        close: closes[i] ?? 0,
        dividends: dividends?.[i] ?? 0,
        stockSplits: stockSplits?.[i] ?? 0,
    }));
}

function baseInput(overrides?: Partial<BacktestInput>): BacktestInput {
    return {
        budget: 10000,
        holdings: [{ label: 'A', weightPct: 100, drip: false }],
        seriesByLabel: {
            A: mkSeries(
                ['2020-01-01', '2020-01-02', '2020-01-03'],
                [100, 110, 120]
            ),
        },
        range: { from: '2020-01-01', to: '2020-01-03' },
        seed: 42,
        riskFreeRate: 0.04,
        ...overrides,
    };
}

// ── Test 1: DRIP ON final value ≥ DRIP OFF final value ───────────────────────
// 3-bar series: dividend paid on day 2, price rises on day 3.
// DRIP ON reinvests the dividend into additional shares at day-2 price,
// then those extra shares appreciate on day 3 → higher final value.

describe('DRIP', () => {
    it('DRIP ON final value >= DRIP OFF for a dividend-paying series', () => {
        // Day 1: buy; Day 2: $5 dividend at close=$100; Day 3: close=$110 (price rises)
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 100, 110],
            [0, 5, 0]
        );
        const dripOn = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: true }],
            seriesByLabel: { A: series },
        });
        const dripOff = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: series },
        });

        expect(dripOn.metrics.finalValue).toBeGreaterThan(
            dripOff.metrics.finalValue
        );
    });

    it('DRIP ON: dividend cash is $0 in schedule (reinvested), DRIP OFF: cash > 0', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-01-02'],
            [100, 100],
            [0, 2]
        );
        const dripOn = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: true }],
            seriesByLabel: { A: series },
        });
        const dripOff = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: series },
        });

        // Non-null assertion: test setup guarantees at least one dividend event.
        const onEvent = dripOn.dividends.schedule[0]!;
        expect(onEvent.cash).toBe(0); // reinvested; no cash payout

        const offEvent = dripOff.dividends.schedule[0]!;
        expect(offEvent.cash).toBeGreaterThan(0);
    });
});

// ── Test 2: Stock split keeps portfolio value continuous ──────────────────────
// 2:1 split on day 2: raw close halves, shares double → same value.

describe('stock split', () => {
    it('2:1 split: value on split bar equals value on pre-split bar (no cliff)', () => {
        // Day 1: close=100 (pre-split); Day 2: close=50 (post-split raw), splits=2; Day 3: close=55
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 50, 55],
            [0, 0, 0],
            [0, 2, 0]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
        });

        const preSplitValue = result.timeline[0]!.value; // day 1
        const splitDayValue = result.timeline[1]!.value; // day 2 (split applied)
        expect(splitDayValue).toBeCloseTo(preSplitValue, 6); // no cliff
    });

    it('2:1 split: post-split shares doubles, day-3 value reflects 2x shares', () => {
        const budget = 10000; // buys 100 shares at $100
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 50, 60], // day 3 closes at $60 (post-split)
            [0, 0, 0],
            [0, 2, 0]
        );
        const result = runBacktest({
            ...baseInput({ budget }),
            seriesByLabel: { A: series },
        });

        // 100 shares × 2 = 200 post-split shares × $60 = $12000
        expect(result.timeline[2]!.value).toBeCloseTo(12000, 4);
        expect(result.perHolding[0]!.shares).toBeCloseTo(200, 6);
    });
});

// ── Test 3: Negative CAGR → all metrics & projection finite ──────────────────

describe('negative CAGR / declining series', () => {
    it('all metrics are finite numbers (no NaN / Infinity)', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-06-01', '2021-01-01'],
            [100, 70, 50]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2021-01-01' },
        });

        const { cagr, maxDrawdown, volatility, finalValue, totalReturnPct } =
            result.metrics;
        expect(Number.isFinite(cagr)).toBe(true);
        expect(Number.isFinite(maxDrawdown)).toBe(true);
        expect(Number.isFinite(volatility)).toBe(true);
        expect(Number.isFinite(finalValue)).toBe(true);
        expect(Number.isFinite(totalReturnPct)).toBe(true);
        expect(cagr).toBeLessThan(0);
    });

    it('projection CAGR curve: all values finite for declining CAGR', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-06-01', '2021-01-01'],
            [100, 70, 50]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2021-01-01' },
        });

        for (const pt of result.projection.cagrCurve) {
            expect(Number.isFinite(pt.value)).toBe(true);
            expect(pt.value).toBeGreaterThanOrEqual(0);
        }
    });

    it('projection Monte Carlo: p10/p50/p90 all finite', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-06-01', '2021-01-01'],
            [100, 70, 50]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2021-01-01' },
        });

        for (const pt of result.projection.monteCarlo) {
            expect(Number.isFinite(pt.p10)).toBe(true);
            expect(Number.isFinite(pt.p50)).toBe(true);
            expect(Number.isFinite(pt.p90)).toBe(true);
        }
    });
});

// ── Test 4: Weight allocation sums to budget; fractional shares correct ───────

describe('weight allocation', () => {
    it('50/50 two-holding: each holding gets budget×0.5 shares', () => {
        const series100 = mkSeries(['2020-01-01', '2020-01-02'], [100, 110]);
        const series200 = mkSeries(['2020-01-01', '2020-01-02'], [200, 220]);
        const budget = 10000;

        const result = runBacktest({
            budget,
            holdings: [
                { label: 'A', weightPct: 50, drip: false },
                { label: 'B', weightPct: 50, drip: false },
            ],
            seriesByLabel: { A: series100, B: series200 },
            range: { from: '2020-01-01', to: '2020-01-02' },
            seed: 42,
            riskFreeRate: 0.04,
        });

        const holdA = result.perHolding.find((h) => h.label === 'A')!;
        const holdB = result.perHolding.find((h) => h.label === 'B')!;

        // A: 5000/100 = 50 shares; B: 5000/200 = 25 shares
        expect(holdA.shares).toBeCloseTo(50, 8);
        expect(holdB.shares).toBeCloseTo(25, 8);
    });

    it('100-pct single holding uses full budget', () => {
        const result = runBacktest(baseInput());
        // 10000/100 = 100 shares; final: 100×120 = 12000
        expect(result.timeline[result.timeline.length - 1]!.value).toBeCloseTo(
            12000,
            4
        );
    });

    it('initial timeline value equals allocated budget (no gaps)', () => {
        const result = runBacktest(baseInput());
        expect(result.timeline[0]!.value).toBeCloseTo(10000, 4);
    });
});

// ── Test 5: Monte Carlo determinism ──────────────────────────────────────────

describe('Monte Carlo determinism', () => {
    it('same seed produces identical p50 across all months', () => {
        const series = mkSeries(
            [
                '2020-01-01',
                '2020-06-01',
                '2021-01-01',
                '2021-06-01',
                '2022-01-01',
            ],
            [100, 110, 90, 105, 115]
        );
        const input: BacktestInput = {
            ...baseInput(),
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2022-01-01' },
            seed: 99,
        };

        const r1 = runBacktest(input);
        const r2 = runBacktest(input);

        for (let i = 0; i < r1.projection.monteCarlo.length; i++) {
            expect(r1.projection.monteCarlo[i]!.p50).toBe(
                r2.projection.monteCarlo[i]!.p50
            );
            expect(r1.projection.monteCarlo[i]!.p10).toBe(
                r2.projection.monteCarlo[i]!.p10
            );
            expect(r1.projection.monteCarlo[i]!.p90).toBe(
                r2.projection.monteCarlo[i]!.p90
            );
        }
    });

    it('different seeds produce different p50 (at some month)', () => {
        const series = mkSeries(
            [
                '2020-01-01',
                '2020-06-01',
                '2021-01-01',
                '2021-06-01',
                '2022-01-01',
            ],
            [100, 110, 90, 105, 115]
        );
        const base: BacktestInput = {
            ...baseInput(),
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2022-01-01' },
        };

        const r1 = runBacktest({ ...base, seed: 1 });
        const r2 = runBacktest({ ...base, seed: 9999 });

        // For a non-trivial series with sigma>0, different seeds MUST diverge somewhere.
        const differs = r1.projection.monteCarlo.some(
            (pt, i) => pt.p50 !== r2.projection.monteCarlo[i]!.p50
        );
        expect(differs).toBe(true);
    });
});

// ── Test 6: maxDrawdown sign and magnitude ────────────────────────────────────

describe('maxDrawdown', () => {
    it('hand-built peak→trough: MDD = (trough/peak) - 1', () => {
        // Series: 100 → 120 (peak) → 80 (trough) → 100 (recovery)
        // Expected MDD = 80/120 - 1 = -1/3 ≈ -0.3333
        const values = [100, 120, 80, 100];
        const mdd = computeMaxDrawdown(values);
        expect(mdd).toBeCloseTo(-1 / 3, 6);
    });

    it('monotonically increasing series has MDD = 0', () => {
        expect(computeMaxDrawdown([100, 110, 120, 130])).toBe(0);
    });

    it('single value has MDD = 0', () => {
        expect(computeMaxDrawdown([100])).toBe(0);
    });

    it('engine MDD negative for declining series', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 120, 80]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
        });
        expect(result.metrics.maxDrawdown).toBeLessThan(0);
        expect(result.metrics.maxDrawdown).toBeCloseTo(-1 / 3, 4);
    });
});
