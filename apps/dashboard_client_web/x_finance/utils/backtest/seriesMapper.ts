// utils/backtest/seriesMapper.ts
// Pure adapter: TPriceSeriesResponse → Record<string, PricePoint[]>.

import type { TPriceSeriesResponse } from '@/apis/getPriceSeries.api';
import type { PricePoint } from '@/types/backtest';

export function toSeriesByLabel(
    resp: TPriceSeriesResponse
): Record<string, PricePoint[]> {
    const result: Record<string, PricePoint[]> = {};
    for (const [label, bars] of Object.entries(resp.series)) {
        result[label] = bars.map((b) => ({
            date: b.date,
            close: b.close,
            dividends: b.dividends,
            stockSplits: b.stockSplits,
        }));
    }
    return result;
}
