// utils/backtest/monthlyStats.test.ts
// Purpose: unit tests for XE.4 — buildMonthlyStats pure selector.
// All fixtures are hand-built; no I/O, no Date objects.
// Note: noUncheckedIndexedAccess — array accesses guarded with ! patterns.

import { describe, it, expect } from 'vitest';
import { buildMonthlyStats } from '@/utils/backtest/monthlyStats';
import { runBacktest } from '@/utils/backtest/engine';
import type { BacktestResult, PricePoint } from '@/types/backtest';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Minimal BacktestResult fixture — avoids running full engine. */
function mkResult(
    bars: { date: string; value: number }[],
    divSchedule: BacktestResult['dividends']['schedule'] = [],
    metrics: Partial<BacktestResult['metrics']> = {}
): BacktestResult {
    const lastValue = bars[bars.length - 1]?.value ?? 0;
    const firstValue = bars[0]?.value ?? 0;
    return {
        timeline: bars,
        metrics: {
            finalValue: lastValue,
            totalReturnPct: firstValue > 0 ? lastValue / firstValue - 1 : 0,
            cagr: 0,
            maxDrawdown: 0,
            volatility: 0,
            sharpe: null,
            cumulativeDividends: divSchedule.reduce((s, e) => s + e.cash, 0),
            totalContributed: firstValue,
            moneyWeightedReturn: null,
            ...metrics,
        },
        perHolding: [],
        dividends: {
            byLabel: {},
            total: divSchedule.reduce((s, e) => s + e.cash, 0),
            schedule: divSchedule,
        },
        projection: {
            cagrCurve: [],
            monteCarlo: [],
            income: {
                annualYieldPct: 0,
                projectedAnnualCash: 0,
                projectedMonthlyCash: 0,
            },
        },
    };
}

// ── Test 1: last row invariants match metrics ─────────────────────────────────

describe('buildMonthlyStats — last row invariants', () => {
    it('last row endValue == metrics.finalValue', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: {
                A: mkSeries(
                    ['2023-01-03', '2023-01-31', '2023-02-28', '2023-03-31'],
                    [100, 110, 105, 120]
                ),
            },
            range: { from: '2023-01-03', to: '2023-03-31' },
            seed: 42,
            riskFreeRate: 0.04,
        });
        const rows = buildMonthlyStats(result);
        const last = rows[rows.length - 1]!;
        expect(last.endValue).toBeCloseTo(result.metrics.finalValue, 4);
    });

    it('last row cumulativeDividend == metrics.cumulativeDividends', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: {
                A: mkSeries(
                    ['2023-01-03', '2023-01-31', '2023-02-28', '2023-03-31'],
                    [100, 110, 105, 120],
                    [0, 1.0, 0, 0.5]
                ),
            },
            range: { from: '2023-01-03', to: '2023-03-31' },
            seed: 42,
            riskFreeRate: 0.04,
        });
        const rows = buildMonthlyStats(result);
        const last = rows[rows.length - 1]!;
        // cumulativeDividend = sum of all schedule.cash (non-DRIP only)
        expect(last.cumulativeDividend).toBeCloseTo(
            result.metrics.cumulativeDividends,
            4
        );
    });

    it('last row cumulativeReturnPct == metrics.totalReturnPct (lump-sum)', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100, drip: false }],
            seriesByLabel: {
                A: mkSeries(
                    ['2023-01-03', '2023-01-31', '2023-02-28'],
                    [100, 110, 130]
                ),
            },
            range: { from: '2023-01-03', to: '2023-02-28' },
            seed: 42,
            riskFreeRate: 0.04,
        });
        const rows = buildMonthlyStats(result);
        const last = rows[rows.length - 1]!;
        // For lump-sum, cumulativeReturnPct = endValue/firstValue-1 which equals
        // metrics.totalReturnPct (both use budget as denominator).
        expect(last.cumulativeReturnPct).toBeCloseTo(
            result.metrics.totalReturnPct,
            4
        );
    });
});

// ── Test 2: no-dividend month shows dividendCash = 0 ─────────────────────────

describe('buildMonthlyStats — zero-dividend month', () => {
    it('month with no dividends → dividendCash === 0', () => {
        const result = mkResult(
            [
                { date: '2024-01-31', value: 10_000 },
                { date: '2024-02-29', value: 11_000 },
            ],
            [] // no dividends at all
        );
        const rows = buildMonthlyStats(result);
        expect(rows.length).toBe(2);
        for (const row of rows) {
            expect(row.dividendCash).toBe(0);
        }
    });
});

// ── Test 3: partial start/end months produce rows ─────────────────────────────

describe('buildMonthlyStats — partial months', () => {
    it('produces a row for a partial start month (mid-month entry)', () => {
        const result = mkResult([
            { date: '2024-01-15', value: 10_000 }, // partial Jan
            { date: '2024-01-31', value: 10_100 }, // end of Jan
            { date: '2024-02-29', value: 10_500 }, // end of Feb
        ]);
        const rows = buildMonthlyStats(result);
        expect(rows.length).toBe(2); // '2024-01' and '2024-02'
        expect(rows[0]!.month).toBe('2024-01');
        expect(rows[0]!.endDate).toBe('2024-01-31'); // last bar wins
        expect(rows[1]!.month).toBe('2024-02');
    });
});

// ── Test 4: DRIP month excluded from dividendCash ────────────────────────────

describe('buildMonthlyStats — DRIP exclusion', () => {
    it('DRIP event (cash: 0) contributes 0 to dividendCash', () => {
        const result = mkResult(
            [
                { date: '2024-01-15', value: 10_000 },
                { date: '2024-01-31', value: 10_500 },
            ],
            [
                // DRIP event — cash is 0 (reinvested into shares)
                { date: '2024-01-15', label: 'A', perShare: 0.5, cash: 0 },
                // non-DRIP event — cash received
                { date: '2024-01-31', label: 'A', perShare: 0.3, cash: 30 },
            ]
        );
        const rows = buildMonthlyStats(result);
        expect(rows.length).toBe(1);
        // Only the non-DRIP cash counts
        expect(rows[0]!.dividendCash).toBeCloseTo(30, 4);
    });
});

// ── Test 5: string-slice TZ safety ───────────────────────────────────────────

describe('buildMonthlyStats — string-slice month bucketing', () => {
    it("'2024-01-01' slices to '2024-01' (no TZ shift)", () => {
        const result = mkResult([
            { date: '2024-01-01', value: 10_000 },
            { date: '2024-01-31', value: 10_200 },
            { date: '2024-02-01', value: 10_400 },
        ]);
        const rows = buildMonthlyStats(result);
        const months = rows.map((r) => r.month);
        expect(months).toContain('2024-01');
        expect(months).toContain('2024-02');
        // '2024-01-01' must be in '2024-01', not bled into Dec-2023
        expect(months).not.toContain('2023-12');
    });
});

// ── Test 6: DCA contribution columns present when flowsByDate given ───────────

describe('buildMonthlyStats — DCA columns', () => {
    it('contribution and totalInvestedToDate present when flowsByDate given', () => {
        const result = mkResult([
            { date: '2024-01-31', value: 10_500 },
            { date: '2024-02-29', value: 11_200 },
        ]);
        const flowsByDate: Record<string, number> = {
            '2024-02-01': 500, // DCA contribution in Feb
        };
        const rows = buildMonthlyStats(result, flowsByDate);
        expect(rows[0]!.contribution).toBeDefined();
        // Jan has no contribution
        expect(rows[0]!.contribution).toBe(0);
        // Feb has contribution
        expect(rows[1]!.contribution).toBe(500);
        expect(rows[1]!.totalInvestedToDate).toBeCloseTo(
            rows[0]!.totalInvestedToDate! + 500,
            4
        );
    });

    it('contribution columns absent for lump-sum (no flowsByDate)', () => {
        const result = mkResult([{ date: '2024-01-31', value: 10_000 }]);
        const rows = buildMonthlyStats(result); // no flowsByDate arg
        expect(rows[0]!.contribution).toBeUndefined();
        expect(rows[0]!.totalInvestedToDate).toBeUndefined();
    });
});

// ── Test 7: empty timeline → empty rows ──────────────────────────────────────

describe('buildMonthlyStats — edge cases', () => {
    it('empty timeline returns []', () => {
        const result = mkResult([]);
        expect(buildMonthlyStats(result)).toEqual([]);
    });
});
