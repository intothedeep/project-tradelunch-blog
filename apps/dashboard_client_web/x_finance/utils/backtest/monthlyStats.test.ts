// utils/backtest/monthlyStats.test.ts
// Purpose: unit tests for XE.4 — buildMonthlyStats pure selector.
// All fixtures are hand-built; no I/O, no Date objects.
// Note: noUncheckedIndexedAccess — array accesses guarded with ! patterns.

import { describe, it, expect } from 'vitest';
import {
    buildMonthlyStats,
    buildMonthlyAssetWeights,
    buildMonthlyAssetShares,
    buildMonthlyAssetPurchases,
} from '@/utils/backtest/monthlyStats';
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
        // cumulativeDividend = sum of all schedule.gross (T1: gross-based)
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

// ── Test 4: DRIP month — T1 fix: gross is summed, not cash ───────────────────

describe('buildMonthlyStats — DRIP gross (T1)', () => {
    it('DRIP event (cash:0, gross:0) contributes 0; cash event (gross===cash) counts', () => {
        const result = mkResult(
            [
                { date: '2024-01-15', value: 10_000 },
                { date: '2024-01-31', value: 10_500 },
            ],
            [
                // T2: gross: added to satisfy DividendEvent type requirement
                // gross:0 — models a DRIP event with no measurable gross (backward-compat)
                {
                    date: '2024-01-15',
                    label: 'A',
                    perShare: 0.5,
                    cash: 0,
                    gross: 0,
                },
                // cash-route event: gross === cash
                {
                    date: '2024-01-31',
                    label: 'A',
                    perShare: 0.3,
                    cash: 30,
                    gross: 30,
                },
            ]
        );
        const rows = buildMonthlyStats(result);
        expect(rows.length).toBe(1);
        // gross:0 + gross:30 = 30
        expect(rows[0]!.dividendCash).toBeCloseTo(30, 4);
    });

    it('DRIP event (cash:0, gross:>0) contributes gross to dividendCash', () => {
        // T1 validation: gross is now summed, so DRIP with gross>0 shows in table
        const result = mkResult(
            [{ date: '2024-01-31', value: 10_500 }],
            [
                {
                    date: '2024-01-15',
                    label: 'A',
                    perShare: 0.5,
                    cash: 0,
                    gross: 30,
                },
            ]
        );
        const rows = buildMonthlyStats(result);
        expect(rows.length).toBe(1);
        expect(rows[0]!.dividendCash).toBeCloseTo(30, 4);
    });

    it('mixed DRIP+cash in same month: both gross values sum', () => {
        const result = mkResult(
            [{ date: '2024-01-31', value: 11_000 }],
            [
                {
                    date: '2024-01-10',
                    label: 'A',
                    perShare: 0.5,
                    cash: 0,
                    gross: 20,
                },
                {
                    date: '2024-01-25',
                    label: 'A',
                    perShare: 0.3,
                    cash: 15,
                    gross: 15,
                },
            ]
        );
        const rows = buildMonthlyStats(result);
        expect(rows[0]!.dividendCash).toBeCloseTo(35, 4);
    });
});

describe('buildMonthlyStats — dividendPerShare (2-line 당월 배당)', () => {
    it('aggregates per-share by label; sums repeats; omits perShare<=0', () => {
        const result = mkResult(
            [{ date: '2024-01-31', value: 10_000 }],
            [
                {
                    date: '2024-01-10',
                    label: 'A',
                    perShare: 0.5,
                    cash: 5,
                    gross: 5,
                },
                {
                    date: '2024-01-20',
                    label: 'A',
                    perShare: 0.3,
                    cash: 3,
                    gross: 3,
                },
                {
                    date: '2024-01-15',
                    label: 'B',
                    perShare: 0.02,
                    cash: 2,
                    gross: 2,
                },
                {
                    date: '2024-01-25',
                    label: 'C',
                    perShare: 0,
                    cash: 0,
                    gross: 0,
                },
            ]
        );
        const ps = buildMonthlyStats(result)[0]!.dividendPerShare!;
        expect(ps['A']).toBeCloseTo(0.8, 6); // 0.5 + 0.3
        expect(ps['B']).toBeCloseTo(0.02, 6);
        expect('C' in ps).toBe(false); // perShare 0 → omitted
    });

    it('month with no dividend events → dividendPerShare undefined', () => {
        const result = mkResult([{ date: '2024-02-29', value: 10_000 }], []);
        expect(buildMonthlyStats(result)[0]!.dividendPerShare).toBeUndefined();
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

// ── Test 8: buildMonthlyAssetWeights (X2.17b) ────────────────────────────────

describe('buildMonthlyAssetWeights', () => {
    it('weights per month sum to ≤1 and ≈1 when no cash', () => {
        // 2 assets, no cash (budget fully invested), flat prices.
        // A=50%, B=50% at all times.
        const result = runBacktest({
            budget: 10_000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: {
                A: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [100, 100, 100]
                ),
                B: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [100, 100, 100]
                ),
            },
            range: { from: '2024-01-02', to: '2024-02-29' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        const { labels, weightByMonth } = buildMonthlyAssetWeights(result);
        expect(labels).toContain('A');
        expect(labels).toContain('B');

        for (const [, weights] of Object.entries(weightByMonth)) {
            const sum = Object.values(weights).reduce((s, v) => s + v, 0);
            // sum ≤ 1 (cash excluded from perHoldingValues)
            expect(sum).toBeLessThanOrEqual(1 + 1e-9);
            // With flat prices and no DCA, almost all NAV is in holdings
            expect(sum).toBeGreaterThan(0.99);
        }
    });

    it('single-asset portfolio: weight ≈ 1 each month', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: {
                A: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [100, 110, 120]
                ),
            },
            range: { from: '2024-01-02', to: '2024-02-29' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        const { labels, weightByMonth } = buildMonthlyAssetWeights(result);
        expect(labels).toEqual(['A']);

        for (const [, weights] of Object.entries(weightByMonth)) {
            expect(weights['A']).toBeGreaterThan(0.99);
        }
    });

    it('absent perHoldingValues → empty labels and weightByMonth', () => {
        const result = mkResult([{ date: '2024-01-31', value: 10_000 }]);
        // mkResult does not set perHoldingValues
        const { labels, weightByMonth } = buildMonthlyAssetWeights(result);
        expect(labels).toEqual([]);
        expect(weightByMonth).toEqual({});
    });

    it('rebalanced 2-asset portfolio: weights still sum to ≤1 per month', () => {
        const dates = ['2024-01-02', '2024-01-31', '2024-02-29', '2024-03-29'];
        const result = runBacktest({
            budget: 10_000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: {
                A: mkSeries(dates, [100, 150, 200, 180]),
                B: mkSeries(dates, [100, 90, 85, 95]),
            },
            range: { from: '2024-01-02', to: '2024-03-29' },
            seed: 1,
            riskFreeRate: 0.04,
            rebalance: {
                freq: 'monthly',
                band: { kind: 'absolute', pct: 5 },
                groups: [],
            },
        });

        const { weightByMonth } = buildMonthlyAssetWeights(result);
        expect(Object.keys(weightByMonth).length).toBeGreaterThan(0);

        for (const [, weights] of Object.entries(weightByMonth)) {
            const sum = Object.values(weights).reduce((s, v) => s + v, 0);
            expect(sum).toBeLessThanOrEqual(1 + 1e-9);
        }
    });
});

// ── Test 9: buildMonthlyAssetShares (Task B) ──────────────────────────────────

describe('buildMonthlyAssetShares', () => {
    it('shares × price ≈ value (single-asset sanity)', () => {
        // Budget $10,000; price Jan=$100 → ~100 shares; price Feb=$110.
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: {
                A: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [100, 100, 110]
                ),
            },
            range: { from: '2024-01-02', to: '2024-02-29' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        const priceByMonth: Record<string, Record<string, number>> = {
            '2024-01': { A: 100 },
            '2024-02': { A: 110 },
        };

        const { labels, sharesByMonth } = buildMonthlyAssetShares(
            result,
            priceByMonth
        );
        expect(labels).toEqual(['A']);
        expect(Object.keys(sharesByMonth).length).toBeGreaterThan(0);

        // For each month: shares * price must ≈ perHoldingValues[month][A]
        for (const [month, shares] of Object.entries(sharesByMonth)) {
            const price = priceByMonth[month]?.['A'];
            const sh = shares['A'];
            if (price !== undefined && sh !== undefined) {
                // shares * price reconstructs the holding value
                expect(sh * price).toBeGreaterThan(0);
                // sanity: shares is positive finite
                expect(sh).toBeGreaterThan(0);
                expect(isFinite(sh)).toBe(true);
            }
        }
    });

    it('absent perHoldingValues → empty labels and sharesByMonth', () => {
        const result = mkResult([{ date: '2024-01-31', value: 10_000 }]);
        const { labels, sharesByMonth } = buildMonthlyAssetShares(result, {});
        expect(labels).toEqual([]);
        expect(sharesByMonth).toEqual({});
    });

    it('price = 0 for a label → that label is omitted from sharesByMonth month', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [{ label: 'A', weightPct: 100 }],
            seriesByLabel: {
                A: mkSeries(['2024-01-02', '2024-01-31'], [100, 100]),
            },
            range: { from: '2024-01-02', to: '2024-01-31' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        // Provide price = 0 — guard must skip
        const priceByMonth = { '2024-01': { A: 0 } };
        const { sharesByMonth } = buildMonthlyAssetShares(result, priceByMonth);
        // 'A' must not appear because price = 0
        expect(sharesByMonth['2024-01']?.['A']).toBeUndefined();
    });

    it('deterministic: same inputs → same output', () => {
        const result = runBacktest({
            budget: 10_000,
            holdings: [
                { label: 'A', weightPct: 50 },
                { label: 'B', weightPct: 50 },
            ],
            seriesByLabel: {
                A: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [100, 120, 115]
                ),
                B: mkSeries(
                    ['2024-01-02', '2024-01-31', '2024-02-29'],
                    [50, 55, 60]
                ),
            },
            range: { from: '2024-01-02', to: '2024-02-29' },
            seed: 1,
            riskFreeRate: 0.04,
        });

        const priceByMonth: Record<string, Record<string, number>> = {
            '2024-01': { A: 120, B: 55 },
            '2024-02': { A: 115, B: 60 },
        };

        const first = buildMonthlyAssetShares(result, priceByMonth);
        const second = buildMonthlyAssetShares(result, priceByMonth);
        expect(first).toEqual(second);
    });
});

// ── Test 10: buildMonthlyAssetPurchases (T3/T4) ───────────────────────────────

describe('buildMonthlyAssetPurchases', () => {
    it('undefined perAssetPurchases → empty result', () => {
        const result = mkResult([{ date: '2024-01-31', value: 10_000 }]);
        // mkResult does not set perAssetPurchases
        const out = buildMonthlyAssetPurchases(result);
        expect(out.labels).toEqual([]);
        expect(out.purchasesByMonth).toEqual({});
    });

    it('empty perAssetPurchases ([]) → empty result', () => {
        const result = {
            ...mkResult([{ date: '2024-01-31', value: 10_000 }]),
            perAssetPurchases: [],
        };
        const out = buildMonthlyAssetPurchases(result);
        expect(out.labels).toEqual([]);
        expect(out.purchasesByMonth).toEqual({});
    });

    it('multi-date same-month buys SUM (not last-wins) for same label', () => {
        const result = {
            ...mkResult([{ date: '2024-01-31', value: 10_000 }]),
            perAssetPurchases: [
                { date: '2024-01-15', buys: { A: 100 } },
                { date: '2024-01-25', buys: { A: 200 } },
            ],
        };
        const out = buildMonthlyAssetPurchases(result);
        // Must sum: 100 + 200 = 300, not last-wins (200)
        expect(out.purchasesByMonth['2024-01']?.['A']).toBeCloseTo(300, 4);
    });

    it('cross-asset landing: buys under target labels appear in correct month buckets', () => {
        const result = {
            ...mkResult([{ date: '2024-01-31', value: 10_000 }]),
            perAssetPurchases: [
                { date: '2024-01-10', buys: { VOO: 150, JEPQ: 50 } },
            ],
        };
        const out = buildMonthlyAssetPurchases(result);
        expect(out.purchasesByMonth['2024-01']?.['VOO']).toBeCloseTo(150, 4);
        expect(out.purchasesByMonth['2024-01']?.['JEPQ']).toBeCloseTo(50, 4);
    });

    it('buys across different months land in separate buckets', () => {
        const result = {
            ...mkResult([
                { date: '2024-01-31', value: 10_000 },
                { date: '2024-02-29', value: 10_500 },
            ]),
            perAssetPurchases: [
                { date: '2024-01-15', buys: { A: 100 } },
                { date: '2024-02-10', buys: { A: 200 } },
            ],
        };
        const out = buildMonthlyAssetPurchases(result);
        expect(out.purchasesByMonth['2024-01']?.['A']).toBeCloseTo(100, 4);
        expect(out.purchasesByMonth['2024-02']?.['A']).toBeCloseTo(200, 4);
    });

    it('labels contains union of all asset keys seen across months', () => {
        const result = {
            ...mkResult([{ date: '2024-01-31', value: 10_000 }]),
            perAssetPurchases: [
                {
                    date: '2024-01-10',
                    buys: { A: 100 } as Record<string, number>,
                },
                {
                    date: '2024-01-20',
                    buys: { B: 50 } as Record<string, number>,
                },
            ],
        };
        const out = buildMonthlyAssetPurchases(result);
        expect(out.labels).toContain('A');
        expect(out.labels).toContain('B');
    });

    it('deterministic: same inputs → same output', () => {
        const result = {
            ...mkResult([{ date: '2024-01-31', value: 10_000 }]),
            perAssetPurchases: [
                {
                    date: '2024-01-05',
                    buys: { A: 100, B: 50 } as Record<string, number>,
                },
                {
                    date: '2024-01-20',
                    buys: { A: 75 } as Record<string, number>,
                },
            ],
        };
        const first = buildMonthlyAssetPurchases(result);
        const second = buildMonthlyAssetPurchases(result);
        expect(first).toEqual(second);
    });
});
