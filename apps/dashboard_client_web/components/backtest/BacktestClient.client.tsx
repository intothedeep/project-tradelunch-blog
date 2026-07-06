'use client';

// components/backtest/BacktestClient.client.tsx
// Purpose: client orchestrator for /backtest. Holds all input state (URL-encoded),
//   fetches price series via the getPriceSeries server action, runs the pure
//   backtest engine via useBacktest, and renders all sub-components.
// The `mockedSeries` prop is used by /backtest/preview to bypass the server action.

import { useState, useEffect, useMemo } from 'react';
import { useBacktestUrl } from '@/hooks/useBacktestUrl.hook';
import { useBacktest } from '@/hooks/useBacktest.hook';
import { LEVERAGED_LABELS } from '@/utils/backtest/universe';
import { buildMonthlyStats } from '@/utils/backtest/monthlyStats';
import { getPriceSeriesAction } from '@/app/actions/getPriceSeries.action';
import type { TPriceSeriesResponse } from '@/apis/getPriceSeries.api';
import type { PricePoint } from '@/types/backtest';
import BudgetInput from './BudgetInput';
import AssetPicker from './AssetPicker.client';
import WeightSliders from './WeightSliders.client';
import DateRangePicker from './DateRangePicker.client';
import ContributionInput from './ContributionInput.client';
import SeedControl from './SeedControl.client';
import MetricsPanel from './MetricsPanel';
import ResultChart from './ResultChart.client';
import StatsTable from './StatsTable';
import DividendTable from './DividendTable';
import IncomeProjection from './IncomeProjection';
import LeverageWarning from './LeverageWarning';
import Disclaimer from './Disclaimer';

const RISK_FREE_RATE = 0.045; // 4.5% — current T-bill proxy
const REFERENCE_LABELS = ['^IXIC', '^NDX'];
// Deep floor for series fetches: pull each asset's FULL history so its true
// inception (e.g. QLD 2006, QQQ 1999) is discoverable and the picker floor
// isn't stuck at the selected range start. The engine slices to `range`.
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

function getFirstDate(series: PricePoint[]): string {
    return series[0]?.date ?? '';
}

type ResultView = 'chart' | 'table';

export default function BacktestClient({ mockedSeries }: BacktestClientProps) {
    const [
        urlState,
        { setBudget, setHoldings, setRange, setContribution, setSeed },
    ] = useBacktestUrl();
    const { budget, holdings, from, to, seed, contribution } = urlState;

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

    // Derive first-available date per selected label
    const seriesFirstDate = useMemo<Record<string, string>>(() => {
        const out: Record<string, string> = {};
        for (const [lbl, pts] of Object.entries(seriesData)) {
            const d = getFirstDate(pts);
            if (d) out[lbl] = d;
        }
        return out;
    }, [seriesData]);

    // Earliest date across selected holdings
    const minAllowedFrom = useMemo(() => {
        const dates = holdings
            .map((h) => seriesFirstDate[h.label])
            .filter((d): d is string => !!d);
        return dates.length > 0
            ? dates.reduce((a, b) => (a > b ? a : b))
            : from;
    }, [holdings, seriesFirstDate, from]);

    // Fetch each selected asset's FULL history (deep floor → today), NOT bounded
    // by the selected range — otherwise an asset's true inception (e.g. QLD 2006)
    // is never discovered and the picker floor stays stuck at the range start.
    // Refetch only when the label SET changes; range changes are sliced by the
    // engine client-side (no refetch needed).
    const labelsKey = holdings
        .map((h) => h.label)
        .filter((l) => l)
        .sort()
        .join(',');

    useEffect(() => {
        if (mockedSeries) return;
        if (!labelsKey) return;
        const labels = labelsKey.split(',');
        setLoading(true);
        setFetchError(null);
        getPriceSeriesAction({
            labels,
            from: HISTORY_FLOOR,
            to: new Date().toISOString().slice(0, 10),
        })
            .then((res) => {
                if (res.ok) setSeriesData(toSeriesByLabel(res.data));
                else setFetchError(res.error.message);
            })
            .finally(() => setLoading(false));
    }, [labelsKey, mockedSeries]);

    // Fetch reference indices once (for DateRangePicker mini chart).
    // from=1971 so the picker backdrop spans the full deep-backfilled index
    // history (^IXIC 1971~ / ^NDX 1985~) — removes the old 2023 floor so
    // bull/bear regimes are selectable. minAllowedFrom still clamps by asset.
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
        };
    }, [budget, holdings, seriesData, from, to, seed, contribution]);

    // seedReady removed (XE.5): seed is always defined via DEFAULT_SEED fallback.
    const result = useBacktest(backtestInput, budgetValid);

    const leveragedSelected = holdings
        .filter((h) => LEVERAGED_LABELS.has(h.label))
        .map((h) => h.label);

    const weightsValid =
        Math.round(holdings.reduce((s, h) => s + h.weightPct, 0)) === 100;

    // Pre-compute monthly rows (memoised — pure derivation from result).
    const monthlyRows = useMemo(
        () => (result ? buildMonthlyStats(result, result.flowsByDate) : []),
        [result]
    );

    return (
        <div className="flex flex-col gap-6">
            {/* ── Controls ─────────────────────────────────────────────────────── */}
            <section
                aria-label="Backtest controls"
                className="flex flex-col gap-4 rounded-lg border bg-card p-4"
            >
                <BudgetInput
                    value={budget}
                    onChange={(v, valid) => {
                        setBudget(v);
                        setBudgetValid(valid);
                    }}
                />
                <AssetPicker
                    holdings={holdings}
                    seriesFirstDate={seriesFirstDate}
                    onChange={setHoldings}
                />
                <WeightSliders
                    holdings={holdings}
                    onChange={setHoldings}
                />
                <DateRangePicker
                    from={from}
                    to={to}
                    minAllowedFrom={minAllowedFrom}
                    ixicSeries={refSeries['^IXIC'] ?? []}
                    ndxSeries={refSeries['^NDX'] ?? []}
                    onChange={setRange}
                />
                <ContributionInput
                    value={contribution}
                    onChange={setContribution}
                />
                <SeedControl
                    seed={seed}
                    onChange={setSeed}
                />
            </section>

            <LeverageWarning labels={leveragedSelected} />

            {/* ── Status ────────────────────────────────────────────────────────── */}
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

            {/* ── Results ───────────────────────────────────────────────────────── */}
            {result && (
                <div className="flex flex-col gap-6">
                    <MetricsPanel
                        metrics={result.metrics}
                        budget={budget}
                        riskFreeRate={RISK_FREE_RATE}
                        hasContribution={contribution !== undefined}
                    />

                    {/* Chart ↔ Table segmented control */}
                    <div className="flex items-center gap-1 self-start rounded-md border p-0.5">
                        <button
                            type="button"
                            onClick={() => setResultView('chart')}
                            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                                resultView === 'chart'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            차트
                        </button>
                        <button
                            type="button"
                            onClick={() => setResultView('table')}
                            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                                resultView === 'table'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            월별 상세
                        </button>
                    </div>

                    {resultView === 'chart' ? (
                        <ResultChart
                            result={result}
                            budget={budget}
                        />
                    ) : (
                        <StatsTable rows={monthlyRows} />
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
