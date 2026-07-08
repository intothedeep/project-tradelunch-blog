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

describe('DRIP', () => {
    it('DRIP ON final value >= DRIP OFF for a dividend-paying series', () => {
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

        const onEvent = dripOn.dividends.schedule[0]!;
        expect(onEvent.cash).toBe(0);

        const offEvent = dripOff.dividends.schedule[0]!;
        expect(offEvent.cash).toBeGreaterThan(0);
    });
});

// ── Test 2: Split-adjusted close ──────────────────────────────────────────────

describe('stock split (split-adjusted feed)', () => {
    it('split marker does not change share count or portfolio value', () => {
        const budget = 10000;
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 100, 120],
            [0, 0, 0],
            [0, 2, 0]
        );
        const result = runBacktest({
            ...baseInput({ budget }),
            seriesByLabel: { A: series },
        });

        expect(result.perHolding[0]!.shares).toBeCloseTo(100, 6);
        expect(result.timeline[1]!.value).toBeCloseTo(10000, 4);
        expect(result.timeline[2]!.value).toBeCloseTo(12000, 4);
    });
});

// ── Test 2b: Pre-split dividend rebasing ─────────────────────────────────────

describe('dividend split-adjustment', () => {
    it('rebases a pre-split dividend by the trailing split factor', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-01-02'],
            [100, 100],
            [2, 0],
            [0, 2]
        );
        const result = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2020-01-02' },
        });
        expect(result.metrics.cumulativeDividends).toBeCloseTo(100, 6);
    });

    it('leaves a post-split dividend unchanged (no trailing split)', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-01-02'],
            [100, 100],
            [0, 2],
            [2, 0]
        );
        const result = runBacktest({
            ...baseInput(),
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: series },
            range: { from: '2020-01-01', to: '2020-01-02' },
        });
        expect(result.metrics.cumulativeDividends).toBeCloseTo(200, 6);
    });
});

// ── Test 3: Negative CAGR ─────────────────────────────────────────────────────

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

// ── Test 4: Weight allocation ─────────────────────────────────────────────────

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

        expect(holdA.shares).toBeCloseTo(50, 8);
        expect(holdB.shares).toBeCloseTo(25, 8);
    });

    it('100-pct single holding uses full budget', () => {
        const result = runBacktest(baseInput());
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

        const differs = r1.projection.monteCarlo.some(
            (pt, i) => pt.p50 !== r2.projection.monteCarlo[i]!.p50
        );
        expect(differs).toBe(true);
    });
});

// ── Test 6: maxDrawdown ───────────────────────────────────────────────────────

describe('maxDrawdown', () => {
    it('hand-built peak→trough: MDD = (trough/peak) - 1', () => {
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

// ── Test 7: dividendReinvestByWeight ─────────────────────────────────────────

describe('dividendReinvestByWeight', () => {
    // A pays $1/share dividend on day 2 (cash route); B pays none.
    // budget=10000: A gets 60% → 60 shares; B gets 40% → 80 shares (@ $50).

    const DATES = ['2020-01-01', '2020-01-02', '2020-01-03'];

    function makeSeries() {
        return {
            A: mkSeries(DATES, [100, 100, 100], [0, 1, 0]),
            B: mkSeries(DATES, [50, 50, 50]),
        };
    }

    it('flag OFF ⇒ cash-routed dividends stay as cash (byte-identical to no-flag)', () => {
        const seriesByLabel = makeSeries();
        const inputBase: BacktestInput = {
            budget: 10000,
            holdings: [
                { label: 'A', weightPct: 60, dividendRoute: { kind: 'cash' } },
                { label: 'B', weightPct: 40, dividendRoute: { kind: 'cash' } },
            ],
            seriesByLabel,
            range: { from: '2020-01-01', to: '2020-01-03' },
            seed: 42,
            riskFreeRate: 0.04,
        };
        const withoutFlag = runBacktest(inputBase);
        const withFlagOff = runBacktest({
            ...inputBase,
            dividendReinvestByWeight: false,
        });
        // Byte-identical behaviour when flag is false
        expect(withFlagOff.timeline).toEqual(withoutFlag.timeline);
        expect(withFlagOff.metrics.finalValue).toBeCloseTo(
            withoutFlag.metrics.finalValue,
            8
        );
        // Cash dividend stays in schedule
        const divEvent = withoutFlag.dividends.schedule[0];
        expect(divEvent?.cash).toBeCloseTo(60, 4); // 60 shares × $1
    });

    it('flag ON ⇒ pooled cash dividends reinvested by divPct', () => {
        const seriesByLabel = makeSeries();
        const result = runBacktest({
            budget: 10000,
            holdings: [
                {
                    label: 'A',
                    weightPct: 60,
                    dividendRoute: { kind: 'cash' },
                    divPct: 50,
                },
                {
                    label: 'B',
                    weightPct: 40,
                    dividendRoute: { kind: 'cash' },
                    divPct: 50,
                },
            ],
            seriesByLabel,
            range: { from: '2020-01-01', to: '2020-01-03' },
            seed: 42,
            riskFreeRate: 0.04,
            dividendReinvestByWeight: true,
        });

        // A: 60 shares × $1 dividend = $60 pooled.
        // Reinvested 50/50: $30 into A (@ $100) + $30 into B (@ $50).
        const day2 = result.perAssetPurchases?.find(
            (p) => p.date === '2020-01-02'
        );
        expect(day2).toBeDefined();
        const totalBuys = Object.values(day2?.buys ?? {}).reduce(
            (s, v) => s + v,
            0
        );
        expect(totalBuys).toBeCloseTo(60, 4);
    });

    it('same/asset DividendRoute does NOT contribute to pool (cashDelta=0)', () => {
        // A has route=same (DRIP) → cashDelta=0 from applyDividends for A.
        // Pool = 0 → reinvestDividendPool not called with meaningful cash.
        // B has no dividends.
        const seriesByLabel = {
            A: mkSeries(['2020-01-01', '2020-01-02'], [100, 100], [0, 1]),
            B: mkSeries(['2020-01-01', '2020-01-02'], [50, 50]),
        };
        const result = runBacktest({
            budget: 10000,
            holdings: [
                {
                    label: 'A',
                    weightPct: 60,
                    dividendRoute: { kind: 'same' }, // DRIP — cashDelta=0 for A
                    divPct: 60,
                },
                {
                    label: 'B',
                    weightPct: 40,
                    dividendRoute: { kind: 'cash' },
                    divPct: 40,
                },
            ],
            seriesByLabel,
            range: { from: '2020-01-01', to: '2020-01-02' },
            seed: 42,
            riskFreeRate: 0.04,
            dividendReinvestByWeight: true,
        });

        const day2 = result.perAssetPurchases?.find(
            (p) => p.date === '2020-01-02'
        );
        // A's DRIP buy appears (60 shares × $1 = $60 gross reinvested into A)
        expect(day2?.buys['A']).toBeCloseTo(60, 4);
        // B receives no pool reinvest (cashDelta=0 since A is DRIP; B has no dividends)
        expect(day2?.buys['B']).toBeUndefined();
    });

    it('XIRR flows unchanged by dividendReinvestByWeight', () => {
        const seriesByLabel = makeSeries();
        const withDrw = runBacktest({
            budget: 10000,
            holdings: [
                {
                    label: 'A',
                    weightPct: 60,
                    dividendRoute: { kind: 'cash' },
                    divPct: 60,
                },
                {
                    label: 'B',
                    weightPct: 40,
                    dividendRoute: { kind: 'cash' },
                    divPct: 40,
                },
            ],
            seriesByLabel,
            range: { from: '2020-01-01', to: '2020-01-03' },
            seed: 42,
            riskFreeRate: 0.04,
            dividendReinvestByWeight: true,
        });
        // flowsByDate should not have dividend-reinvest entries (not external flows)
        expect(withDrw.flowsByDate).toBeUndefined();
    });
});
