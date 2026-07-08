'use client';

// components/backtest/BacktestClient.client.tsx
// Orchestrator: URL state → price fetch → backtest engine → results.
// X2-P2b.12: cmp mode — ComparisonPanel + dual synth lines in ResultChart.
// Wave-C LOC: 5 memos extracted to useBacktestStats; SynthControls extracted.

import { useState, useEffect, useMemo } from 'react';
import { useBacktestUrl } from '@/hooks/useBacktestUrl.hook';
import { useSyntheticBacktest } from '@/hooks/useSyntheticBacktest.hook';
import { useBacktestStats } from '@/hooks/useBacktestStats.hook';
import { LEVERAGED_LABELS } from '@/utils/backtest/universe';
import { getPriceSeriesAction } from '@/app/actions/getPriceSeries.action';
import { toSeriesByLabel } from '@/utils/backtest/seriesMapper';
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
import ComparisonPanel from './ComparisonPanel';
import AssetPriceChart from './AssetPriceChart.client';

const RISK_FREE_RATE = 0.045;
const REFERENCE_LABELS = ['^IXIC', '^NDX'];
const HISTORY_FLOOR = '1971-01-01';

interface BacktestClientProps {
    mockedSeries?: TPriceSeriesResponse;
}

type ResultView = 'chart' | 'assets' | 'table';

const VIEW_LABELS: Record<ResultView, string> = {
    chart: '차트',
    assets: '자산 가격',
    table: '월별 상세',
};

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
            setSynth,
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
        synth,
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
        budgetValid
    );

    // Earliest selectable start = latest first-date across holdings, computed from
    // the DISPLAY series so an active synth splice (JEPQ) extends the floor back
    // to the chosen base's inception. Recomputes on base change → picker min/max
    // track the selected assets + base range. `from` is NOT auto-moved; the user
    // picks within the recalculated bounds (Max preset jumps to this floor).
    const minAllowedFrom = useMemo(() => {
        const dates = holdings
            .map((h) => displaySeriesData[h.label]?.[0]?.date)
            .filter((d): d is string => !!d);
        return dates.length > 0
            ? dates.reduce((a, b) => (a > b ? a : b))
            : from;
    }, [holdings, displaySeriesData, from]);

    // Start-date shortcuts: one per holding's inception + the synth base's
    // inception (e.g. QQQ ~1999) when synth is active — lets the user snap the
    // range start to any selected asset's first data date.
    const startDateOptions = useMemo(() => {
        const opts = holdings
            .map((h) => ({ label: h.label, date: seriesFirstDate[h.label] }))
            .filter((o): o is { label: string; date: string } => !!o.date);
        if (synth) {
            const baseDate = refSeries[synth.base]?.[0]?.date;
            if (baseDate && !opts.some((o) => o.label === synth.base)) {
                opts.push({ label: synth.base, date: baseDate });
            }
        }
        return opts;
    }, [holdings, seriesFirstDate, synth, refSeries]);

    // When synth is active (single-method reg/str), the results section shows the
    // selected-range synthetic-inclusive pass directly (honours `from`) — no
    // real/full toggle. cmp keeps its own ComparisonPanel, so it stays on `result`.
    const showSynthFull =
        !!synth && synth.method !== 'cmp' && fullResult !== undefined;
    const displayResult = showSynthFull && fullResult ? fullResult : result;

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
    const {
        monthlyRows,
        assetPrices,
        assetWeights,
        assetShares,
        assetPurchases,
        yearlyRows,
    } = useBacktestStats(
        displayResult,
        displaySeriesData,
        holdings,
        from,
        to,
        budget
    );
    const isCmp =
        synth?.method === 'cmp' &&
        !!cmpRegFullResult &&
        !!cmpStrFullResult &&
        !!cmpRegMeta &&
        !!cmpStrMeta;

    // YYYY-MM set of months that had rebalance trades — for StatsTable badge.
    const rebalanceMonths = useMemo(
        () =>
            new Set(
                (displayResult?.rebalance?.events ?? []).map((e) =>
                    e.date.slice(0, 7)
                )
            ),
        [displayResult]
    );

    // YYYY-MM-DD array of rebalance event dates — for chart vertical markers.
    const rebalanceDates = useMemo(
        () => (displayResult?.rebalance?.events ?? []).map((e) => e.date),
        [displayResult]
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
                startDateOptions={startDateOptions}
                ixicSeries={refSeries['^IXIC'] ?? []}
                ndxSeries={refSeries['^NDX'] ?? []}
                minAllowedFrom={minAllowedFrom}
                rebalance={rebalance}
                manualFlows={manualFlows}
                synth={synth}
                setBudget={setBudget}
                setHoldings={setHoldings}
                setRange={setRange}
                setContribution={setContribution}
                setSeed={setSeed}
                setRebalance={setRebalance}
                setManualFlows={setManualFlows}
                setSynth={setSynth}
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
                        metrics={(displayResult ?? result).metrics}
                        budget={budget}
                        riskFreeRate={RISK_FREE_RATE}
                        hasContribution={contribution !== undefined}
                        rebalance={(displayResult ?? result).rebalance}
                        synthMeta={synthMeta}
                    />
                    <div className="flex items-center gap-1 self-start rounded-md border p-0.5">
                        {(['chart', 'assets', 'table'] as const).map((view) => (
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
                                {VIEW_LABELS[view]}
                            </button>
                        ))}
                    </div>
                    {resultView === 'chart' ? (
                        <ResultChart
                            result={displayResult ?? result}
                            budget={budget}
                            synthMeta={synthMeta}
                            fullTimeline={
                                showSynthFull ? undefined : fullResult?.timeline
                            }
                            strFullTimeline={cmpStrFullResult?.timeline}
                            synthMethod={synth?.method}
                            rebalanceDates={rebalanceDates}
                        />
                    ) : resultView === 'assets' ? (
                        <AssetPriceChart
                            seriesData={displaySeriesData}
                            labels={holdings.map((h) => h.label)}
                            from={from}
                            to={to}
                            realInception={synthMeta?.realInception}
                            rebalanceDates={rebalanceDates}
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
                                assetPurchasesByMonth={
                                    assetPurchases?.purchasesByMonth
                                }
                                realInception={synthMeta?.realInception}
                                rebalanceMonths={rebalanceMonths}
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
