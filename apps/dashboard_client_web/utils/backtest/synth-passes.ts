// utils/backtest/synth-passes.ts
// Purpose: pure pass orchestration for synthetic backtest — injectable runner
// for unit-testable pass counting (X2-P2b.9/10).
//
// Pass counts per method:
//   reg  — 2: real-only (range.from = realInception) + reg-full
//   str  — 2: real-only + str-full
//   cmp  — 3: ONE shared real-only + reg-full + str-full (dedup)
//
// Invariant: runner called EXACTLY N times per method (no extra calls).
// Default runner = runBacktest; inject a spy to count calls in unit tests.

import { buildSyntheticHistory } from '@/utils/backtest/synth/index';
import { runBacktest } from '@/utils/backtest/engine';
import type {
    PricePoint,
    BacktestInput,
    BacktestResult,
} from '@/types/backtest';

export interface SynthPassMeta {
    realInception: string;
    r2: number;
    cappedAt?: number;
    /**
     * true when the structural method used k·VIX proxy vol for ≥1 pre-inception
     * bar (VXN unavailable pre-~2001). Surfaced for the proxy-vol UI warning.
     */
    hasProxy?: boolean;
}

export interface SynthPassesConfig {
    backtestInput: BacktestInput;
    shortLabel: string;
    shortSeries: PricePoint[];
    baseSeries: PricePoint[];
    volVxn: PricePoint[] | undefined;
    volVix: PricePoint[] | undefined;
    riskFreeRate: number;
    method: 'reg' | 'str' | 'cmp';
}

export interface SynthPassesResult {
    /** Pass-1: real-only (range.from = realInception). Headline metrics. */
    realResult: BacktestResult;
    /** Pass-2: full-span result (reg-full for reg; str-full for str; reg-full for cmp). */
    fullResult: BacktestResult;
    /** Primary splice (reg for reg/cmp; str for str). */
    splicedSeries: PricePoint[];
    meta: SynthPassMeta;
    // compare-mode only (undefined for reg / str):
    regFullResult?: BacktestResult;
    strFullResult?: BacktestResult;
    regMeta?: SynthPassMeta;
    strMeta?: SynthPassMeta;
}

/** Injectable runner — default is runBacktest; inject a spy in unit tests. */
export type BacktestRunner = (input: BacktestInput) => BacktestResult;

// ── Internal helpers ──────────────────────────────────────────────────────────

interface SpliceOut {
    spliced: PricePoint[];
    splicedByLabel: Record<string, PricePoint[]>;
    meta: SynthPassMeta;
}

function toMeta(
    realInception: string,
    r2: number,
    cappedAt?: number,
    hasProxy?: boolean
): SynthPassMeta {
    const m: SynthPassMeta = { realInception, r2 };
    if (cappedAt !== undefined) m.cappedAt = cappedAt;
    if (hasProxy) m.hasProxy = true;
    return m;
}

function buildRegSplice(cfg: SynthPassesConfig): SpliceOut | null {
    try {
        const res = buildSyntheticHistory({
            short: cfg.shortSeries,
            base: cfg.baseSeries,
            seed: cfg.backtestInput.seed,
            method: 'reg',
            shortLabel: cfg.shortLabel,
        });
        if (res.points.length === 0) return null;
        const spliced = [...res.points, ...cfg.shortSeries];
        return {
            spliced,
            splicedByLabel: {
                ...cfg.backtestInput.seriesByLabel,
                [cfg.shortLabel]: spliced,
            },
            meta: toMeta(res.realInception, res.r2, res.cappedAt, res.hasProxy),
        };
    } catch {
        return null;
    }
}

function buildStrSplice(cfg: SynthPassesConfig): SpliceOut | null {
    if (!cfg.volVxn?.length || !cfg.volVix?.length) return null;
    try {
        const res = buildSyntheticHistory({
            short: cfg.shortSeries,
            base: cfg.baseSeries,
            seed: cfg.backtestInput.seed,
            method: 'str',
            shortLabel: cfg.shortLabel,
            volVxn: cfg.volVxn,
            volVix: cfg.volVix,
            riskFreeRate: cfg.riskFreeRate,
        });
        if (res.points.length === 0) return null;
        const spliced = [...res.points, ...cfg.shortSeries];
        return {
            spliced,
            splicedByLabel: {
                ...cfg.backtestInput.seriesByLabel,
                [cfg.shortLabel]: spliced,
            },
            meta: toMeta(res.realInception, res.r2, res.cappedAt, res.hasProxy),
        };
    } catch {
        return null;
    }
}

/** 2 runner calls: real-only (pass 1) + full-span (pass 2). */
function runTwoPasses(
    cfg: SynthPassesConfig,
    splice: SpliceOut,
    runner: BacktestRunner
): SynthPassesResult {
    const { backtestInput } = cfg;
    const realInput: BacktestInput = {
        ...backtestInput,
        seriesByLabel: splice.splicedByLabel,
        range: { from: splice.meta.realInception, to: backtestInput.range.to },
    };
    const fullInput: BacktestInput = {
        ...backtestInput,
        seriesByLabel: splice.splicedByLabel,
    };
    return {
        realResult: runner(realInput),
        fullResult: runner(fullInput),
        splicedSeries: splice.spliced,
        meta: splice.meta,
    };
}

/**
 * 3 runner calls: ONE shared real-only (pass 1) + reg-full (pass 2) + str-full (pass 3).
 * Real-only uses the reg splice — same realInception as str (both from alignOverlap).
 */
function runThreePasses(
    cfg: SynthPassesConfig,
    regSplice: SpliceOut,
    strSplice: SpliceOut,
    runner: BacktestRunner
): SynthPassesResult {
    const { backtestInput } = cfg;
    // Pass 1: shared real-only (engine ignores synthetic bars before realInception).
    const realInput: BacktestInput = {
        ...backtestInput,
        seriesByLabel: regSplice.splicedByLabel,
        range: {
            from: regSplice.meta.realInception,
            to: backtestInput.range.to,
        },
    };
    // Pass 2: reg full-span.
    const regFullInput: BacktestInput = {
        ...backtestInput,
        seriesByLabel: regSplice.splicedByLabel,
    };
    // Pass 3: str full-span.
    const strFullInput: BacktestInput = {
        ...backtestInput,
        seriesByLabel: strSplice.splicedByLabel,
    };
    const realResult = runner(realInput); // call 1
    const regFullResult = runner(regFullInput); // call 2
    const strFullResult = runner(strFullInput); // call 3
    return {
        realResult,
        fullResult: regFullResult,
        splicedSeries: regSplice.spliced,
        meta: regSplice.meta,
        regFullResult,
        strFullResult,
        regMeta: regSplice.meta,
        strMeta: strSplice.meta,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Orchestrate synthetic passes for reg / str / cmp. Returns null when splice
 * building fails (e.g. empty overlap, missing vol). Default runner = runBacktest;
 * inject a spy to count calls in unit tests.
 */
export function runSynthPasses(
    cfg: SynthPassesConfig,
    runner: BacktestRunner = runBacktest
): SynthPassesResult | null {
    const { method } = cfg;
    if (method === 'reg') {
        const splice = buildRegSplice(cfg);
        if (!splice) return null;
        return runTwoPasses(cfg, splice, runner);
    }
    if (method === 'str') {
        const splice = buildStrSplice(cfg);
        if (!splice) return null;
        return runTwoPasses(cfg, splice, runner);
    }
    // cmp: build both splices — fail if either is unavailable.
    const regSplice = buildRegSplice(cfg);
    if (!regSplice) return null;
    const strSplice = buildStrSplice(cfg);
    if (!strSplice) return null;
    return runThreePasses(cfg, regSplice, strSplice, runner);
}
