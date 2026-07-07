'use client';

// hooks/useSyntheticBacktest.hook.ts
// Purpose: build backtestInput, splice synthetic pre-inception history, run
// double-pass backtest, and expose the unified result + display series.
// (X2-P2.7a splice, X2-P2.7 double-pass dual metrics, LOC-trim Wave-2.)
//
// Invariant: synth OFF (synth undefined) ⇒ delegates to single-pass useBacktest;
// output is byte-identical to pre-synth.
//
// Double-pass (synth ON):
//   pass-1 (real-only)  — range.from = realInception; headline metrics.
//   pass-2 (full-span)  — range.from = userFrom (synthetic start); advisory.

import { useMemo } from 'react';
import { buildSyntheticHistory } from '@/utils/backtest/synth/index';
import { runBacktest } from '@/utils/backtest/engine';
import { useBacktest } from '@/hooks/useBacktest.hook';
import type {
    PricePoint,
    BacktestInput,
    BacktestResult,
    Holding,
    ContributionPlan,
    RebalancePolicy,
} from '@/types/backtest';
import type { SynthUrlState } from '@/utils/backtest/url-codec-synth';

// Mirrors BacktestClient's RISK_FREE_RATE (4.5 % T-bill).
const RISK_FREE_RATE = 0.045;

export interface SynthBacktestMeta {
    realInception: string;
    r2: number;
    cappedAt?: number;
}

export interface SynthBacktestResult {
    /** Pass-1: real-only range (realInception → to). Headline metrics. */
    realResult: BacktestResult;
    /** Pass-2: full synthetic span (userFrom → to). Advisory "(modeled)". */
    fullResult: BacktestResult;
    meta: SynthBacktestMeta;
    /** The spliced series (synthetic prepended + real). */
    splicedSeries: PricePoint[];
}

/** Unified output consumed by BacktestClient. */
export interface SynthBacktestOut {
    /** Pass-1 headline when synth is on; single-pass otherwise. */
    result: BacktestResult | null;
    /** Spliced short-asset series when synth active; raw seriesData otherwise. */
    displaySeriesData: Record<string, PricePoint[]>;
    /** Base label to add to the ref fetch when synth is active; undefined otherwise. */
    synthBaseLabel: string | undefined;
    /** Pass-2 full-span result; defined only when synth is active. */
    fullResult: BacktestResult | undefined;
    /** Synth build metadata; defined only when synth is active. */
    synthMeta: SynthBacktestMeta | undefined;
}

/**
 * Build backtestInput, optionally splice synthetic history, and run one or two
 * backtest passes. Returns unified output that BacktestClient consumes directly.
 */
export function useSyntheticBacktest(
    synth: SynthUrlState | undefined,
    budget: number,
    holdings: Holding[],
    seriesData: Record<string, PricePoint[]>,
    refSeries: Record<string, PricePoint[]>,
    from: string,
    to: string,
    seed: number,
    contribution: ContributionPlan | undefined,
    rebalance: RebalancePolicy | undefined,
    manualFlows: BacktestInput['manualFlows'],
    ready: boolean
): SynthBacktestOut {
    const synthBaseLabel = synth?.method === 'reg' ? synth.base : undefined;

    // Standard BacktestInput — same construction as the old component memo.
    const backtestInput = useMemo((): BacktestInput | null => {
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
            rebalance,
            manualFlows,
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

    // Synth splice + double-pass (null when synth is off or prerequisites missing).
    const synthInternal = useMemo((): SynthBacktestResult | null => {
        if (!ready || !backtestInput || !synth) return null;
        if (synth.method !== 'reg') return null;

        const { shortLabel, base } = synth;

        const isHolding = holdings.some((h) => h.label === shortLabel);
        if (!isHolding) return null;

        const shortSeries = seriesData[shortLabel];
        const baseSeries = seriesData[base] ?? refSeries[base];
        if (!shortSeries || shortSeries.length === 0) return null;
        if (!baseSeries || baseSeries.length === 0) return null;

        let synthResult: ReturnType<typeof buildSyntheticHistory>;
        try {
            synthResult = buildSyntheticHistory({
                short: shortSeries,
                base: baseSeries,
                seed: backtestInput.seed,
                method: 'reg',
                shortLabel,
            });
        } catch {
            // Empty overlap or other precondition failure → synth OFF gracefully.
            return null;
        }

        const { points, realInception, r2, cappedAt } = synthResult;
        if (points.length === 0) return null;

        // Splice: prepend synthetic points before the real series.
        const splicedSeries: PricePoint[] = [...points, ...shortSeries];

        const splicedByLabel: Record<string, PricePoint[]> = {
            ...backtestInput.seriesByLabel,
            [shortLabel]: splicedSeries,
        };

        // Pass-1: real-only range — headline metrics (byte-identical to today's
        // single-pass when run over the same range).
        const realInput: BacktestInput = {
            ...backtestInput,
            seriesByLabel: splicedByLabel,
            range: { from: realInception, to: backtestInput.range.to },
        };
        const realResult = runBacktest(realInput);

        // Pass-2: full synthetic span — advisory "(modeled)" result.
        const fullInput: BacktestInput = {
            ...backtestInput,
            seriesByLabel: splicedByLabel,
        };
        const fullResult = runBacktest(fullInput);

        const meta: SynthBacktestMeta = { realInception, r2 };
        if (cappedAt !== undefined) meta.cappedAt = cappedAt;

        return { realResult, fullResult, meta, splicedSeries };
    }, [synth, holdings, seriesData, refSeries, backtestInput, ready]);

    // Single-pass fallback (null input when synth is active — synthInternal runs instead).
    const singlePassResult = useBacktest(
        synthInternal ? null : backtestInput,
        ready
    );

    const result = synthInternal ? synthInternal.realResult : singlePassResult;

    const displaySeriesData = useMemo(() => {
        if (!synthInternal || !synth) return seriesData;
        return {
            ...seriesData,
            [synth.shortLabel]: synthInternal.splicedSeries,
        };
    }, [synthInternal, synth, seriesData]);

    return {
        result,
        displaySeriesData,
        synthBaseLabel,
        fullResult: synthInternal?.fullResult,
        synthMeta: synthInternal?.meta,
    };
}
