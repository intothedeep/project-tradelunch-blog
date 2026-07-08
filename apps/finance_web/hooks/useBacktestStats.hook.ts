'use client';

// hooks/useBacktestStats.hook.ts
// Purpose: memoize all secondary stats derived from BacktestResult — extracts
// the five useMemo calls that previously lived in BacktestClient (LOC cleanup,
// Wave-C X2-P2b). Pure derivation; no side effects.

import { useMemo } from 'react';
import type { BacktestResult, Holding, PricePoint } from '@/types/backtest';
import {
    buildMonthlyStats,
    buildMonthlyAssetWeights,
    buildMonthlyAssetShares,
    buildMonthlyAssetPurchases,
    type MonthlyStatRow,
    type MonthlyAssetWeights,
    type MonthlyAssetShares,
    type MonthlyAssetPurchases,
} from '@/utils/backtest/monthlyStats';
import {
    buildMonthlyAssetPrices,
    type MonthlyAssetPrices,
} from '@/utils/backtest/monthlyAssetPrices';
import {
    buildYearlyStats,
    type YearlyStatRow,
} from '@/utils/backtest/yearlyStats';

export interface BacktestStatsOut {
    monthlyRows: MonthlyStatRow[];
    assetPrices: MonthlyAssetPrices;
    assetWeights: MonthlyAssetWeights | null;
    assetShares: MonthlyAssetShares | null;
    assetPurchases: MonthlyAssetPurchases | null;
    yearlyRows: YearlyStatRow[];
}

export function useBacktestStats(
    result: BacktestResult | null,
    displaySeriesData: Record<string, PricePoint[]>,
    holdings: Holding[],
    from: string,
    to: string,
    budget: number
): BacktestStatsOut {
    const monthlyRows = useMemo(
        () => (result ? buildMonthlyStats(result, result.flowsByDate) : []),
        [result]
    );
    const assetPrices = useMemo(
        () =>
            buildMonthlyAssetPrices(
                displaySeriesData,
                holdings.map((h) => h.label),
                from,
                to
            ),
        [displaySeriesData, holdings, from, to]
    );
    const assetWeights = useMemo(
        () => (result ? buildMonthlyAssetWeights(result) : null),
        [result]
    );
    const assetShares = useMemo(
        () =>
            result
                ? buildMonthlyAssetShares(result, assetPrices.priceByMonth)
                : null,
        [result, assetPrices.priceByMonth]
    );
    const assetPurchases = useMemo(
        () => (result ? buildMonthlyAssetPurchases(result) : null),
        [result]
    );
    const yearlyRows = useMemo(
        () => (result ? buildYearlyStats(result, budget) : []),
        [result, budget]
    );
    return {
        monthlyRows,
        assetPrices,
        assetWeights,
        assetShares,
        assetPurchases,
        yearlyRows,
    };
}
