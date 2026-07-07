// utils/backtest/synth/types.ts
// Purpose: local domain types for synthetic pre-inception history (Phase 2a).
// No runtime logic — type declarations only. Additive to types/backtest.ts.

import type { PricePoint } from '@/types/backtest';

/** One aligned trading day where BOTH the short and base series have data. */
export interface OverlapBar {
    date: string; // 'YYYY-MM-DD'
    rShort: number; // total return of the short (proxied) asset on this bar
    rBase: number; // total return of the base (long-history) asset on this bar
}

/** Result of aligning the short and base series on their common calendar. */
export interface OverlapResult {
    bars: OverlapBar[]; // ascending by date; total-return pairs
    realInception: string; // short series' first REAL date ('YYYY-MM-DD')
    /** Realized (annualized) distribution yield of the short asset over overlap. */
    shortAnnualYield: number;
}

/**
 * Asymmetric two-regime OLS fit of the short asset onto the base asset.
 *   base-up  days (rBase ≥ 0): rShort = alphaUp   + betaUp   · rBase
 *   base-down days (rBase < 0): rShort = alphaDown + betaDown · rBase
 * Separate intercept AND slope per regime (documented choice — captures
 * covered-call capped upside, typically betaUp < betaDown).
 */
export interface RegressionFit {
    alphaUp: number;
    alphaDown: number;
    betaUp: number;
    betaDown: number;
    r2: number; // in-sample R² over the pooled two-regime fit, ∈ [0, 1]
    residuals: number[]; // empirical (actual − fitted), overlap order (oldest→newest)
}

/** Method selector for synthetic history generation. */
export type SynthMethod = 'reg' | 'str';

/** Input to the top-level orchestrator. */
export interface SynthConfig {
    short: PricePoint[]; // short-history asset (e.g. JEPQ), ascending
    base: PricePoint[]; // long-history proxy asset (e.g. QQQ), ascending
    seed: number; // deterministic bootstrap seed
    /** Requested synthetic depth in years; clamped to 2×overlap by default. */
    capYears?: number;
    method: SynthMethod;
    /** Label of the short asset — decorrelates the per-asset bootstrap seed. */
    shortLabel: string;
}

/** Output of the orchestrator. */
export interface SynthResult {
    points: PricePoint[]; // synthetic pre-inception bars, ascending, seam-continuous
    realInception: string; // first REAL date of the short series
    r2: number; // fit quality
    /** Set only when capYears requested a deeper span than 2×overlap allows. */
    cappedAt?: number; // the effective cap in years actually applied
}
