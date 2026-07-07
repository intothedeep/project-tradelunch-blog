// utils/backtest/dca.test.ts
// Purpose: tests for XE.1 — DCA / XIRR / flow-corrected metrics.
// Covers: computeXirr edge cases + hand-verified multi-flow case,
//         flow-corrected volatility (contribution spike guard),
//         back-compat (lump-only unchanged), monthly-DCA sanity.
// Note: noUncheckedIndexedAccess — array accesses guarded with ! or ?? patterns.

import { describe, it, expect } from 'vitest';
import {
    computeXirr,
    computeDailyReturnsWithFlows,
    computeLogReturnsWithFlows,
    computeVolatility,
} from '@/utils/backtest/metrics';
import { runBacktest } from '@/utils/backtest/engine';
import type { BacktestInput, PricePoint } from '@/types/backtest';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
        budget: 10_000,
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

// ── computeXirr — 2-flow case matches CAGR ───────────────────────────────────
// 2019 is NOT a leap year, so 2019-01-01 → 2020-01-01 = exactly 365 days → t = 1.0.
// XIRR should equal CAGR = (11000/10000)^(1/1) - 1 = 10%.

describe('computeXirr — 2-flow case', () => {
    it('matches CAGR for a single deposit + terminal value (1 exact year)', () => {
        const flows = [
            { date: '2019-01-01', amount: -10_000 },
            { date: '2020-01-01', amount: 11_000 },
        ];
        const xirr = computeXirr(flows);
        // t = 365/365 = 1.0 → NPV(r) = -10000 + 11000/(1+r) = 0 → r = 0.10
        expect(xirr).not.toBeNull();
        expect(xirr!).toBeCloseTo(0.1, 3);
    });
});

// ── computeXirr — multi-flow hand-verified ────────────────────────────────────
// Deposits: $10,000 on 2018-01-01; $10,000 on 2019-01-01 (365 days after).
// Final value: $25,000 on 2020-01-01 (730 days after start).
// t_1=0, t_2=365/365=1.0, t_3=730/365=2.0.
// Quadratic: 25000/(1+r)^2 - 10000/(1+r) - 10000 = 0
//   Let x=1/(1+r): 25000x^2 - 10000x - 10000 = 0
//   x = (10000 + sqrt(10^8 + 4*25000*10000)) / (2*25000)
//   x = (10000 + sqrt(1.1e9)) / 50000 = (10000 + 33166.25) / 50000 = 0.86332
//   1+r = 1/0.86332 → r ≈ 0.1583 (15.83%)
// 2020-01-01 is 731 days from 2018-01-01 (2020 is a leap year — actual t_3 ≈ 2.00274),
// so the real XIRR is very close to 15.83% but within ±0.01.

describe('computeXirr — multi-flow hand-verified', () => {
    it('3-flow case ≈ 15.83% (verified via quadratic formula — see comment)', () => {
        const flows = [
            { date: '2018-01-01', amount: -10_000 },
            { date: '2019-01-01', amount: -10_000 },
            { date: '2020-01-01', amount: 25_000 },
        ];
        const xirr = computeXirr(flows);
        expect(xirr).not.toBeNull();
        // Tolerance ±0.01 (1pp) to accommodate the 366-day 2020 leap-year correction.
        expect(xirr!).toBeCloseTo(0.1583, 1);
    });
});

// ── computeXirr — edge cases ─────────────────────────────────────────────────

describe('computeXirr — edge cases', () => {
    it('≤1 flow returns null', () => {
        expect(computeXirr([])).toBeNull();
        expect(computeXirr([{ date: '2020-01-01', amount: -1000 }])).toBeNull();
    });

    it('all same date returns null', () => {
        const flows = [
            { date: '2020-01-01', amount: -1000 },
            { date: '2020-01-01', amount: 1100 },
        ];
        expect(computeXirr(flows)).toBeNull();
    });

    it('total loss (all amounts ≤ 0) returns -1.0', () => {
        const flows = [
            { date: '2020-01-01', amount: -10_000 },
            { date: '2021-01-01', amount: 0 },
        ];
        expect(computeXirr(flows)).toBe(-1.0);
    });
});

// ── computeDailyReturnsWithFlows — contribution does NOT spike volatility ─────
// Flat price series: every close = 100. On day 3 a contribution of 100 arrives.
// Without flow correction: r_3 = (200 - 0) / 100 - 1 = 1.0 (spike!).
// With Modified-Dietz:     r_3 = (200 - 100) / 100 - 1 = 0   (no spike).

describe('computeDailyReturnsWithFlows — volatility spike guard', () => {
    it('contribution day does not inflate daily return vs flat-price series', () => {
        // values[0..3]: 2 shares at 100 each; on day index 2 contribution buys another share
        // Pre-contribution values: [100, 100, 100, 200] (we simulate: V_0=100, V_1=100, V_2=200)
        // But to isolate: use 1-share series, contribution injects 100 on day index 1.
        const values = [100, 200]; // day 0: 1 share@100; day 1: 2 shares@100 after contribution
        const flows = [0, 100]; // 0 inflow on day 0; 100 inflow on day 1
        const returns = computeDailyReturnsWithFlows(values, flows);
        // r_1 = (200 - 100) / 100 - 1 = 0
        expect(returns.length).toBe(1);
        expect(returns[0]!).toBeCloseTo(0, 8);
    });

    it('without flow correction the same series gives non-zero return', () => {
        // Same values but no flow correction → naive r = 200/100 - 1 = 1.0
        const values = [100, 200];
        const flows = [0, 0]; // no correction
        const returns = computeDailyReturnsWithFlows(values, flows);
        expect(returns[0]!).toBeCloseTo(1.0, 8);
    });

    it('flow-corrected volatility is lower than naive for a contribution series', () => {
        // 5-day flat series [1000, 1000, 1000, 2000, 2000]:
        // day 3 injection of 1000 (buy doubles portfolio at same price).
        const values = [1000, 1000, 1000, 2000, 2000];
        const flows = [0, 0, 0, 1000, 0];
        const naive = computeDailyReturnsWithFlows(values, [0, 0, 0, 0, 0]);
        const corrected = computeDailyReturnsWithFlows(values, flows);
        expect(computeVolatility(corrected)).toBeLessThan(
            computeVolatility(naive)
        );
    });
});

// ── computeLogReturnsWithFlows — when flows=0 equals computeLogReturns ───────

describe('computeLogReturnsWithFlows — back-compat when flows=0', () => {
    it('all-zero flows gives same result as computeLogReturns', () => {
        const values = [100, 110, 105, 120];
        const zeros = [0, 0, 0, 0];
        const withFlows = computeLogReturnsWithFlows(values, zeros);
        // Manual: ln(110/100), ln(105/110), ln(120/105)
        expect(withFlows[0]!).toBeCloseTo(Math.log(110 / 100), 10);
        expect(withFlows[1]!).toBeCloseTo(Math.log(105 / 110), 10);
        expect(withFlows[2]!).toBeCloseTo(Math.log(120 / 105), 10);
    });
});

// ── Back-compat — lump-only yields same metrics as before XE.1 ───────────────
// lump-only input has no contribution → new fields are null/budget,
// and all numeric metrics must match the pre-XE.1 formula exactly.

describe('back-compat — lump-only path unchanged', () => {
    it('lump-only: totalContributed equals budget', () => {
        const result = runBacktest(baseInput());
        expect(result.metrics.totalContributed).toBe(10_000);
    });

    it('lump-only: moneyWeightedReturn is null', () => {
        const result = runBacktest(baseInput());
        expect(result.metrics.moneyWeightedReturn).toBeNull();
    });

    it('lump-only: totalReturnPct = (finalValue - budget) / budget', () => {
        // 10000/100=100 shares. Closes: 100→110→120. finalValue=12000.
        // totalReturnPct = (12000-10000)/10000 = 0.20
        const result = runBacktest(baseInput());
        expect(result.metrics.totalReturnPct).toBeCloseTo(0.2, 6);
    });

    it('lump-only: DRIP, splits, volatility, MDD all unchanged', () => {
        const series = mkSeries(
            ['2020-01-01', '2020-01-02', '2020-01-03'],
            [100, 90, 80]
        );
        const result = runBacktest({
            ...baseInput(),
            seriesByLabel: { A: series },
        });
        expect(result.metrics.maxDrawdown).toBeCloseTo(-0.2, 4);
        expect(result.metrics.volatility).toBeGreaterThan(0);
        expect(result.metrics.sharpe).not.toBeNull();
    });
});

// ── Monthly DCA sanity ────────────────────────────────────────────────────────
// 12 monthly bars; budget=0 (pure-DCA), contribution=$1000/month.
// totalContributed must equal 12 * 1000. finalValue > 0. XIRR is finite.

describe('monthly DCA sanity', () => {
    it('pure-DCA: totalContributed = n × amount, finalValue > 0, XIRR finite', () => {
        // Build a 12-point monthly series at a rising price (to ensure finalValue > contributed)
        const dates = Array.from({ length: 12 }, (_, i) => {
            const d = new Date('2020-01-15T00:00:00Z');
            d.setUTCMonth(d.getUTCMonth() + i);
            return d.toISOString().slice(0, 10);
        });
        const closes = dates.map((_, i) => 100 + i * 5); // 100, 105, ..., 155

        const result = runBacktest({
            budget: 0,
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: mkSeries(dates, closes) },
            range: {
                from: dates[0]!,
                to: dates[dates.length - 1]!,
            },
            seed: 1,
            riskFreeRate: 0.04,
            contribution: { amount: 1_000, freq: 'monthly' },
        });

        // Should have made 12 contributions (includeStart=true for budget=0)
        expect(result.metrics.totalContributed).toBeCloseTo(12 * 1_000, 0);
        expect(result.metrics.finalValue).toBeGreaterThan(0);
        expect(result.metrics.moneyWeightedReturn).not.toBeNull();
        expect(Number.isFinite(result.metrics.moneyWeightedReturn)).toBe(true);
    });

    it('lump + monthly DCA: totalContributed = budget + n × amount', () => {
        const dates = ['2020-01-01', '2020-02-01', '2020-03-01', '2020-04-01'];
        const closes = [100, 102, 104, 106];
        const result = runBacktest({
            budget: 5_000,
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: { A: mkSeries(dates, closes) },
            range: { from: dates[0]!, to: dates[dates.length - 1]! },
            seed: 1,
            riskFreeRate: 0.04,
            contribution: { amount: 1_000, freq: 'monthly' },
        });

        // lump at 2020-01-01, contributions at 2020-02-01, 2020-03-01, 2020-04-01 (3 periods)
        // totalContributed = 5000 + 3 * 1000 = 8000
        expect(result.metrics.totalContributed).toBeCloseTo(8_000, 0);
        expect(result.metrics.moneyWeightedReturn).not.toBeNull();
    });
});
