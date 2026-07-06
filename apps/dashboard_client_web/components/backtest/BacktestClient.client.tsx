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
import { getPriceSeriesAction } from '@/app/actions/getPriceSeries.action';
import type { TPriceSeriesResponse } from '@/apis/getPriceSeries.api';
import type { PricePoint } from '@/types/backtest';
import BudgetInput from './BudgetInput';
import AssetPicker from './AssetPicker.client';
import WeightSliders from './WeightSliders.client';
import DateRangePicker from './DateRangePicker.client';
import MetricsPanel from './MetricsPanel';
import ResultChart from './ResultChart.client';
import DividendTable from './DividendTable';
import IncomeProjection from './IncomeProjection';
import LeverageWarning from './LeverageWarning';
import Disclaimer from './Disclaimer';

const RISK_FREE_RATE = 0.045; // 4.5% — current T-bill proxy
const REFERENCE_LABELS = ['^IXIC', '^NDX'];

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

export default function BacktestClient({ mockedSeries }: BacktestClientProps) {
    const [urlState, { setBudget, setHoldings, setRange }] = useBacktestUrl();
    const { budget, holdings, from, to, seed, seedReady } = urlState;

    const [budgetValid, setBudgetValid] = useState(true);
    const [seriesData, setSeriesData] = useState<Record<string, PricePoint[]>>(
        mockedSeries ? toSeriesByLabel(mockedSeries) : {}
    );
    const [refSeries, setRefSeries] = useState<Record<string, PricePoint[]>>(
        {}
    );
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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

    // Fetch asset series whenever labels or range changes (skipped for mock preview).
    // Sorted label key: stable dep so the fetch re-runs only when the set of
    // selected symbols (not weights/drip) changes.
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
        getPriceSeriesAction({ labels, from, to })
            .then((res) => {
                if (res.ok) setSeriesData(toSeriesByLabel(res.data));
                else setFetchError(res.error.message);
            })
            .finally(() => setLoading(false));
    }, [labelsKey, from, to, mockedSeries]);

    // Fetch reference indices once (for DateRangePicker mini chart).
    useEffect(() => {
        if (mockedSeries) return;
        getPriceSeriesAction({
            labels: REFERENCE_LABELS,
            from: '2023-01-01',
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
        };
    }, [budget, holdings, seriesData, from, to, seed]);

    const result = useBacktest(backtestInput, seedReady && budgetValid);

    const leveragedSelected = holdings
        .filter((h) => LEVERAGED_LABELS.has(h.label))
        .map((h) => h.label);

    const weightsValid =
        Math.round(holdings.reduce((s, h) => s + h.weightPct, 0)) === 100;

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
                    />
                    <ResultChart
                        result={result}
                        budget={budget}
                    />
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
