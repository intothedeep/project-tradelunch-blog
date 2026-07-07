'use client';

// hooks/useSyntheticBacktest.hook.ts
// Purpose: build backtestInput, splice synthetic pre-inception history, run
// passes via runSynthPasses, expose unified result + display series.
// (X2-P2.7a splice, X2-P2.7 double-pass, X2-P2b.9/10 str/cmp multi-pass.)
//
// Invariant: synth OFF (synth undefined) or method=reg ⇒ output + URL
// byte-identical to Phase 2a (single-pass useBacktest delegates unchanged).
//
// Pass counts (dispatched in synth-passes.ts):
//   reg  — 2: real-only + full-span reg
//   str  — 2: real-only + full-span str
//   cmp  — 3: ONE shared real-only + reg-full + str-full

import { useMemo } from 'react';
import { runSynthPasses } from '@/utils/backtest/synth-passes';
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
import type {
    SynthPassesResult,
    SynthPassMeta,
} from '@/utils/backtest/synth-passes';

// Re-export SynthPassMeta as SynthBacktestMeta for backward compat.
export type { SynthPassMeta as SynthBacktestMeta } from '@/utils/backtest/synth-passes';

// Mirrors BacktestClient's RISK_FREE_RATE (4.5 % T-bill).
const RISK_FREE_RATE = 0.045;

/** Unified output consumed by BacktestClient. */
export interface SynthBacktestOut {
    /** Pass-1 headline when synth is on; single-pass otherwise. */
    result: BacktestResult | null;
    /** Spliced short-asset series when synth active; raw seriesData otherwise. */
    displaySeriesData: Record<string, PricePoint[]>;
    /** Base label to include in the ref fetch when synth is active. */
    synthBaseLabel: string | undefined;
    /** Pass-2 full-span result; defined when synth active (reg/str: method-full; cmp: reg-full). */
    fullResult: BacktestResult | undefined;
    /** Synth build metadata; defined only when synth is active. */
    synthMeta: SynthPassMeta | undefined;
    /** Non-null when str/cmp vol is required but not yet available. */
    synthError: string | undefined;
    // compare-mode fields for Wave-C ComparisonPanel:
    cmpRegFullResult: BacktestResult | undefined;
    cmpStrFullResult: BacktestResult | undefined;
    cmpRegMeta: SynthPassMeta | undefined;
    cmpStrMeta: SynthPassMeta | undefined;
}

/**
 * Build backtestInput, optionally splice synthetic history, and run one or more
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
    // For ALL methods, the base series must be fetched as a reference.
    const synthBaseLabel = synth ? synth.base : undefined;

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

    // Synth splice + pass orchestration (null when synth off or prerequisites missing).
    // Memoization key includes `synth` (covers shortLabel, base, method) + vol series.
    const synthInternal = useMemo((): SynthPassesResult | null => {
        if (!ready || !backtestInput || !synth) return null;
        const { shortLabel, base, method } = synth;

        const isHolding = holdings.some((h) => h.label === shortLabel);
        if (!isHolding) return null;

        const shortSeries = seriesData[shortLabel];
        const baseSeries = seriesData[base] ?? refSeries[base];
        if (!shortSeries?.length || !baseSeries?.length) return null;

        return runSynthPasses({
            backtestInput,
            shortLabel,
            shortSeries,
            baseSeries,
            volVxn: refSeries['^VXN'],
            volVix: refSeries['^VIX'],
            riskFreeRate: RISK_FREE_RATE,
            method,
        });
    }, [synth, holdings, seriesData, refSeries, backtestInput, ready]);

    // Explicit error for str/cmp when vol is required but not yet in refSeries.
    const synthError = useMemo<string | undefined>(() => {
        if (!synth || synth.method === 'reg') return undefined;
        if (!ready) return undefined;
        const hasVol =
            (refSeries['^VXN']?.length ?? 0) > 0 &&
            (refSeries['^VIX']?.length ?? 0) > 0;
        if (!hasVol)
            return 'Structural / Compare method requires volatility data (^VXN, ^VIX) — loading.';
        return undefined;
    }, [synth, ready, refSeries]);

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
        synthError,
        cmpRegFullResult: synthInternal?.regFullResult,
        cmpStrFullResult: synthInternal?.strFullResult,
        cmpRegMeta: synthInternal?.regMeta,
        cmpStrMeta: synthInternal?.strMeta,
    };
}
