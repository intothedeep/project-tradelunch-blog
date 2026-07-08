// utils/backtest/yearlyStats.test.ts
import { describe, it, expect } from 'vitest';
import { buildYearlyStats } from '@/utils/backtest/yearlyStats';
import { computeCagr, computeXirr } from '@/utils/backtest/metrics';
import type { BacktestResult } from '@/types/backtest';

function mkResult(
    timeline: { date: string; value: number }[],
    flowsByDate?: Record<string, number>
): BacktestResult {
    return {
        timeline,
        metrics: {
            finalValue: timeline[timeline.length - 1]?.value ?? 0,
            totalReturnPct: 0,
            cagr: 0,
            maxDrawdown: 0,
            volatility: 0,
            sharpe: null,
            cumulativeDividends: 0,
            totalContributed: 0,
            moneyWeightedReturn: null,
        },
        perHolding: [],
        dividends: { byLabel: {}, total: 0, schedule: [] },
        projection: {
            cagrCurve: [],
            monteCarlo: [],
            income: {
                annualYieldPct: 0,
                projectedAnnualCash: 0,
                projectedMonthlyCash: 0,
            },
        },
        ...(flowsByDate ? { flowsByDate } : {}),
    };
}

describe('buildYearlyStats', () => {
    it('one row per calendar year; last row = last timeline value', () => {
        const result = mkResult([
            { date: '2020-06-01', value: 100 },
            { date: '2021-06-01', value: 150 },
            { date: '2022-06-01', value: 130 },
        ]);
        const rows = buildYearlyStats(result, 100);
        expect(rows.map((r) => r.year)).toEqual(['2020', '2021', '2022']);
        expect(rows[2]!.endValue).toBe(130);
    });

    it('lump-sum: annualised = time-weighted CAGR-to-date (bars/252 convention)', () => {
        const timeline = [
            { date: '2020-06-01', value: 100 },
            { date: '2020-07-01', value: 120 },
            { date: '2021-06-01', value: 200 },
        ];
        const rows = buildYearlyStats(mkResult(timeline), 100);
        // 2021 row: bars=3 → years=3/252; matches computeCagr(startValue, endValue, years).
        const expected = computeCagr(100, 200, 3 / 252);
        expect(rows[1]!.annualizedReturnPct).toBeCloseTo(expected, 10);
    });

    it('DCA: annualised = XIRR-to-date and last row reconciles with headline flows', () => {
        // budget 1000 @ 2020-01-01, +1000 contribution @ 2021-01-01, end 2500 @ 2021-12-31.
        const timeline = [
            { date: '2020-01-01', value: 1000 },
            { date: '2020-12-31', value: 1200 }, // 2020 year-end
            { date: '2021-01-01', value: 2200 },
            { date: '2021-12-31', value: 2500 }, // 2021 year-end
        ];
        const flowsByDate = { '2021-01-01': 1000 };
        const rows = buildYearlyStats(mkResult(timeline, flowsByDate), 1000);

        // Last-year XIRR must equal the same flows a headline XIRR would use.
        const expected = computeXirr([
            { date: '2020-01-01', amount: -1000 },
            { date: '2021-01-01', amount: -1000 },
            { date: '2021-12-31', amount: 2500 },
        ]);
        expect(rows[1]!.annualizedReturnPct).toBeCloseTo(expected!, 8);

        // 2020 year-end (before the contribution) uses only the initial budget.
        const expected2020 = computeXirr([
            { date: '2020-01-01', amount: -1000 },
            { date: '2020-12-31', amount: 1200 },
        ]);
        expect(rows[0]!.annualizedReturnPct).toBeCloseTo(expected2020!, 8);
    });

    it('empty timeline → empty rows', () => {
        expect(buildYearlyStats(mkResult([]), 100)).toEqual([]);
    });
});
