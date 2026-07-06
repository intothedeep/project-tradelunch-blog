'use client';

// components/backtest/BacktestClient.client.tsx
// Orchestrator: URL-encoded state → price fetch → backtest engine → results.
// X2 wave-4a: rebalance + manualFlows threaded in; controls in BacktestControls.
// X2 wave-4b: rebalance summary in MetricsPanel; weight% columns in StatsTable.

import { useState, useEffect, useMemo } from 'react';
import { useBacktestUrl } from '@/hooks/useBacktestUrl.hook';
import { useBacktest } from '@/hooks/useBacktest.hook';
import { LEVERAGED_LABELS } from '@/utils/backtest/universe';
import {
    buildMonthlyStats,
    buildMonthlyAssetWeights,
} from '@/utils/backtest/monthlyStats';
import { buildMonthlyAssetPrices } from '@/utils/backtest/monthlyAssetPrices';
import { buildYearlyStats } from '@/utils/backtest/yearlyStats';
import { getPriceSeriesAction } from '@/app/actions/getPriceSeries.action';
import type { TPriceSeriesResponse } from '@/apis/getPriceSeries.api';
import type { PricePoint } from '@/types/backtest';
import BacktestControls from './BacktestControls.client';
import MetricsPanel from './MetricsPanel';
import ResultChart from './ResultChart.client';
import StatsTable from './StatsTable';
import YearlyTable from './YearlyTable';
import DividendTable from './DividendTable';
import IncomeProjection from './IncomeProjection';
import LeverageWarning from './LeverageWarning';
import Disclaimer from './Disclaimer';

const RISK_FREE_RATE = 0.045;
const REFERENCE_LABELS = ['^IXIC', '^NDX'];
// Full history floor — engine slices to `range`; enables true inception discovery.
const HISTORY_FLOOR = '1971-01-01';

interface BacktestClientProps {
    mockedSeries?: TPriceSeriesResponse;
}

function toSeriesByLabel(
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

type ResultView = 'chart' | 'table';

export default function BacktestClient({ mockedSeries }: BacktestClientProps) {
    const [
        urlState,
        {
            setBudget,
            setHoldings,
            setRange,
            setContribution,
            setSeed,
            setRebalance,
            setManualFlows,
        },
    ] = useBacktestUrl();
    const {
        budget,
        holdings,
        from,
        to,
        seed,
        contribution,
        rebalance,
        manualFlows,
    } = urlState;

    const [budgetValid, setBudgetValid] = useState(true);
    const [seriesData, setSeriesData] = useState<Record<string, PricePoint[]>>(
        mockedSeries ? toSeriesByLabel(mockedSeries) : {}
    );
    const [refSeries, setRefSeries] = useState<Record<string, PricePoint[]>>(
        {}
    );
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resultView, setResultView] = useState<ResultView>('chart');

    const seriesFirstDate = useMemo<Record<string, string>>(() => {
        const out: Record<string, string> = {};
        for (const [lbl, pts] of Object.entries(seriesData)) {
            const d = pts[0]?.date ?? '';
            if (d) out[lbl] = d;
        }
        return out;
    }, [seriesData]);

    const minAllowedFrom = useMemo(() => {
        const dates = holdings
            .map((h) => seriesFirstDate[h.label])
            .filter((d): d is string => !!d);
        return dates.length > 0
            ? dates.reduce((a, b) => (a > b ? a : b))
            : from;
    }, [holdings, seriesFirstDate, from]);

    const labelsKey = holdings
        .map((h) => h.label)
        .filter((l) => l)
        .sort()
        .join(',');

    useEffect(() => {
        if (mockedSeries) return;
        if (!labelsKey) return;
        setLoading(true);
        setFetchError(null);
        getPriceSeriesAction({
            labels: labelsKey.split(','),
            from: HISTORY_FLOOR,
            to: new Date().toISOString().slice(0, 10),
        })
            .then((res) => {
                if (res.ok) setSeriesData(toSeriesByLabel(res.data));
                else setFetchError(res.error.message);
            })
            .finally(() => setLoading(false));
    }, [labelsKey, mockedSeries]);

    useEffect(() => {
        if (mockedSeries) return;
        getPriceSeriesAction({
            labels: REFERENCE_LABELS,
            from: '1971-01-01',
            to: new Date().toISOString().slice(0, 10),
        }).then((res) => {
            if (res.ok) setRefSeries(toSeriesByLabel(res.data));
        });
    }, [mockedSeries]);

    const backtestInput = useMemo(() => {
        if (holdings.length === 0 || Object.keys(seriesData).length === 0)
            return null;
        return {
            budget,
            holdings,
            seriesByLabel: seriesData,
            range: { from, to },
            seed,
            riskFreeRate: RISK_FREE_RATE,
            contribution,
            rebalance, // X2: undefined = legacy no-rebalance (zero-regression)
            manualFlows, // X2: undefined = legacy path
        };
    }, [
        budget,
        holdings,
        seriesData,
        from,
        to,
        seed,
        contribution,
        rebalance,
        manualFlows,
    ]);

    const result = useBacktest(backtestInput, budgetValid);

    const leveragedSelected = holdings
        .filter((h) => LEVERAGED_LABELS.has(h.label))
        .map((h) => h.label);
    const weightsValid =
        Math.round(holdings.reduce((s, h) => s + h.weightPct, 0)) === 100;

    const monthlyRows = useMemo(
        () => (result ? buildMonthlyStats(result, result.flowsByDate) : []),
        [result]
    );
    const assetPrices = useMemo(
        () =>
            buildMonthlyAssetPrices(
                seriesData,
                holdings.map((h) => h.label),
                from,
                to
            ),
        [seriesData, holdings, from, to]
    );
    // X2.17b: per-asset month-end weight% derived from perHoldingValues.
    const assetWeights = useMemo(
        () => (result ? buildMonthlyAssetWeights(result) : null),
        [result]
    );
    const yearlyRows = useMemo(
        () => (result ? buildYearlyStats(result, budget) : []),
        [result, budget]
    );

    return (
        <div className="flex flex-col gap-6">
            <BacktestControls
                budget={budget}
                holdings={holdings}
                from={from}
                to={to}
                seed={seed}
                contribution={contribution}
                seriesFirstDate={seriesFirstDate}
                ixicSeries={refSeries['^IXIC'] ?? []}
                ndxSeries={refSeries['^NDX'] ?? []}
                minAllowedFrom={minAllowedFrom}
                rebalance={rebalance}
                manualFlows={manualFlows}
                setBudget={setBudget}
                setHoldings={setHoldings}
                setRange={setRange}
                setContribution={setContribution}
                setSeed={setSeed}
                setRebalance={setRebalance}
                setManualFlows={setManualFlows}
                onBudgetValidChange={setBudgetValid}
            />

            <LeverageWarning labels={leveragedSelected} />

            {loading && (
                <p className="text-sm text-muted-foreground animate-pulse">
                    Loading price data…
                </p>
            )}
            {fetchError && (
                <div className="rounded border border-destructive px-4 py-3 text-sm text-destructive">
                    {fetchError}
                </div>
            )}
            {!weightsValid && (
                <p className="text-sm text-muted-foreground">
                    Adjust weights to sum to 100% to run the backtest.
                </p>
            )}

            {result && (
                <div className="flex flex-col gap-6">
                    <MetricsPanel
                        metrics={result.metrics}
                        budget={budget}
                        riskFreeRate={RISK_FREE_RATE}
                        hasContribution={contribution !== undefined}
                        rebalance={result.rebalance}
                    />

                    <div className="flex items-center gap-1 self-start rounded-md border p-0.5">
                        {(['chart', 'table'] as const).map((view) => (
                            <button
                                key={view}
                                type="button"
                                onClick={() => setResultView(view)}
                                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                                    resultView === view
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {view === 'chart' ? '차트' : '월별 상세'}
                            </button>
                        ))}
                    </div>

                    {resultView === 'chart' ? (
                        <ResultChart
                            result={result}
                            budget={budget}
                        />
                    ) : (
                        <div className="flex flex-col gap-6">
                            <YearlyTable
                                rows={yearlyRows}
                                isDca={contribution !== undefined}
                            />
                            <StatsTable
                                rows={monthlyRows}
                                assetLabels={assetPrices.labels}
                                assetPriceByMonth={assetPrices.priceByMonth}
                                assetWeightByMonth={assetWeights?.weightByMonth}
                            />
                        </div>
                    )}

                    <IncomeProjection
                        income={result.projection.income}
                        budget={budget}
                    />
                    <DividendTable dividends={result.dividends} />
                </div>
            )}

            <Disclaimer />
        </div>
    );
}
