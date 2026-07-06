// utils/backtest/monthlyAssetPrices.test.ts
import { describe, it, expect } from 'vitest';
import { buildMonthlyAssetPrices } from '@/utils/backtest/monthlyAssetPrices';
import type { PricePoint } from '@/types/backtest';

function mk(dates: string[], closes: number[]): PricePoint[] {
    return dates.map((date, i) => ({
        date,
        close: closes[i] ?? 0,
        dividends: 0,
        stockSplits: 0,
    }));
}

describe('buildMonthlyAssetPrices', () => {
    it('picks the last bar per month as the month-end close', () => {
        const series = mk(
            ['2020-01-02', '2020-01-31', '2020-02-14'],
            [100, 110, 120]
        );
        const { labels, priceByMonth } = buildMonthlyAssetPrices(
            { A: series },
            ['A'],
            '2020-01-01',
            '2020-12-31'
        );
        expect(labels).toEqual(['A']);
        expect(priceByMonth['2020-01']?.['A']).toBe(110); // month-end, not 100
        expect(priceByMonth['2020-02']?.['A']).toBe(120);
    });

    it('respects the [from, to] slice', () => {
        const series = mk(['2019-12-31', '2020-01-31'], [90, 110]);
        const { priceByMonth } = buildMonthlyAssetPrices(
            { A: series },
            ['A'],
            '2020-01-01',
            '2020-12-31'
        );
        expect(priceByMonth['2019-12']).toBeUndefined(); // before `from`
        expect(priceByMonth['2020-01']?.['A']).toBe(110);
    });

    it('handles multiple labels and dedupes / drops missing series', () => {
        const a = mk(['2020-01-31'], [10]);
        const b = mk(['2020-01-31'], [20]);
        const { labels, priceByMonth } = buildMonthlyAssetPrices(
            { A: a, B: b },
            ['A', 'A', 'B', 'MISSING'],
            '2020-01-01',
            '2020-12-31'
        );
        expect(labels).toEqual(['A', 'B']); // deduped, MISSING dropped
        expect(priceByMonth['2020-01']).toEqual({ A: 10, B: 20 });
    });
});
