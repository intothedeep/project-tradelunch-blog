'use client';

// components/backtest/BacktestClient.client.tsx
// Orchestrator: URL state → price fetch → backtest engine → results.
// X2-P2b.12: cmp mode — ComparisonPanel + dual synth lines in ResultChart.
// Wave-C LOC: 5 memos extracted to useBacktestStats; SynthControls extracted.
// Draft/Apply: BacktestControls owns draft state; engine + results read
// COMMITTED (URL) state only and recompute exclusively on Apply.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useBacktestUrl } from '@/hooks/useBacktestUrl.hook';
import { useSyntheticBacktest } from '@/hooks/useSyntheticBacktest.hook';
import { useBacktestStats } from '@/hooks/useBacktestStats.hook';
import { LEVERAGED_LABELS } from '@/utils/backtest/universe';
import { getPriceSeriesAction } from '@/app/actions/getPriceSeries.action';
import { toSeriesByLabel } from '@/utils/backtest/seriesMapper';
import type { TPriceSeriesResponse } from '@/apis/getPriceSeries.api';
import type { PricePoint } from '@/types/backtest';
import type { BacktestUrlState } from '@/hooks/useBacktestUrl.hook';
import BacktestControls from './BacktestControls.client';
import MetricsPanel from './MetricsPanel';
import ResultChart from './ResultChart.client';
import StatsTable from './StatsTable';
import YearlyTable from './YearlyTable';
import DividendTable from './DividendTable';
import IncomeProjection from './IncomeProjection';
import LeverageWarning from './LeverageWarning';
import Disclaimer from './Disclaimer';
import ComparisonPanel from './ComparisonPanel';

const RISK_FREE_RATE = 0.045;
const REFERENCE_LABELS = ['^IXIC', '^NDX'];
const HISTORY_FLOOR = '1971-01-01';

interface BacktestClientProps {
    mockedSeries?: TPriceSeriesResponse;
}

type ResultView = 'chart' | 'table';

export default function BacktestClient({ mockedSeries }: BacktestClientProps) {
    const [
        urlState,
        { commitAll },
    ] = useBacktestUrl();

    // All engine + result rendering reads COMMITTED (URL) values.
    const {
        budget,
        holdings,
        from,
        to,
        seed,
        contribution,
        rebalance,
        manualFlows,
        synth,
    } = urlState;

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

    // Engine is ready when seriesData is present. Committed budget is always
    // valid (validated before Apply); no separate budgetValid gate needed.
    const engineReady = Object.keys(seriesData).length > 0;

    const {
        result,
        displaySeriesData,
        synthBaseLabel,
        synthMeta,
        fullResult,
        synthError,
        cmpRegFullResult,
        cmpStrFullResult,
        cmpRegMeta,
        cmpStrMeta,
    } = useSyntheticBacktest(
        synth,
        budget,
        holdings,
        seriesData,
        refSeries,
        from,
        to,
        seed,
        contribution,
        rebalance,
        manualFlows,
        engineReady
    );

    useEffect(() => {
        if (mockedSeries) return;
        const volNeeded = synth?.method === 'str' || synth?.method === 'cmp';
        const refLabels = [
            ...REFERENCE_LABELS,
            ...(synthBaseLabel ? [synthBaseLabel] : []),
            ...(volNeeded ? ['^VXN', '^VIX'] : []),
        ];
        getPriceSeriesAction({
            labels: refLabels,
            from: HISTORY_FLOOR,
            to: new Date().toISOString().slice(0, 10),
        }).then((res) => {
            if (res.ok) setRefSeries(toSeriesByLabel(res.data));
        });
    }, [mockedSeries, synthBaseLabel, synth?.method]);

    const leveragedSelected = holdings
        .filter((h) => LEVERAGED_LABELS.has(h.label))
        .map((h) => h.label);

    const weightsValid =
        Math.round(holdings.reduce((s, h) => s + h.weightPct, 0)) === 100;

    const { monthlyRows, assetPrices, assetWeights, assetShares, yearlyRows } =
        useBacktestStats(result, displaySeriesData, holdings, from, to, budget);
    const isCmp =
        synth?.method === 'cmp' &&
        !!cmpRegFullResult &&
        !!cmpStrFullResult &&
        !!cmpRegMeta &&
        !!cmpStrMeta;

    // Stable callback so BacktestControls never re-renders due to onCommit identity change.
    const handleCommit = useCallback(
        (next: BacktestUrlState) => commitAll(next),
        [commitAll]
    );

    return (
        <div className="flex flex-col gap-6">
            <BacktestControls
                committed={urlState}
                seriesFirstDate={seriesFirstDate}
                ixicSeries={refSeries['^IXIC'] ?? []}
                ndxSeries={refSeries['^NDX'] ?? []}
                minAllowedFrom={minAllowedFrom}
                onCommit={handleCommit}
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
            {synthError && (
                <div className="rounded border border-destructive px-4 py-3 text-sm text-destructive">
                    {synthError}
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
                        fullMetrics={fullResult?.metrics}
                        synthMeta={synthMeta}
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
                            synthMeta={synthMeta}
                            fullTimeline={fullResult?.timeline}
                            strFullTimeline={cmpStrFullResult?.timeline}
                            synthMethod={synth?.method}
                        />
                    ) : (
                        <div className="flex flex-col gap-6">
                            <YearlyTable
                                rows={yearlyRows}
                                isDca={contribution !== undefined}
                                realInception={synthMeta?.realInception}
                            />
                            <StatsTable
                                rows={monthlyRows}
                                assetLabels={assetPrices.labels}
                                assetPriceByMonth={assetPrices.priceByMonth}
                                assetWeightByMonth={assetWeights?.weightByMonth}
                                assetSharesByMonth={assetShares?.sharesByMonth}
                                realInception={synthMeta?.realInception}
                            />
                        </div>
                    )}
                    {isCmp && (
                        <ComparisonPanel
                            realResult={result}
                            regFullResult={cmpRegFullResult!}
                            strFullResult={cmpStrFullResult!}
                            regMeta={cmpRegMeta!}
                            strMeta={cmpStrMeta!}
                            riskFreeRate={RISK_FREE_RATE}
                            hasContribution={contribution !== undefined}
                        />
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
