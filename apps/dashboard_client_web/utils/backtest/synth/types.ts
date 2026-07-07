// utils/backtest/synth/types.ts
// Purpose: local domain types for synthetic pre-inception history (Phase 2a/2b).
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
    // ── Method 'str' (structural covered-call synth) inputs ───────────────────
    // REQUIRED for method:'str' (throws if absent); IGNORED for method:'reg'.
    // The UI wave wires these fetches (VXN ~2001+, VIX ~1990+) — see resolveVol.
    /** Implied-vol series: CBOE VXN (Nasdaq-100 vol). close = index level. */
    volVxn?: PricePoint[];
    /** Implied-vol series: CBOE VIX (S&P-500 vol), the pre-VXN proxy source. */
    volVix?: PricePoint[];
    /** Annual risk-free rate for Black–Scholes premium pricing. Default 0.04. */
    riskFreeRate?: number;
}

/** Output of the orchestrator. */
export interface SynthResult {
    points: PricePoint[]; // synthetic pre-inception bars, ascending, seam-continuous
    realInception: string; // first REAL date of the short series
    r2: number; // fit quality
    /** Set only when capYears requested a deeper span than 2×overlap allows. */
    cappedAt?: number; // the effective cap in years actually applied
    /**
     * true when method='str' and ≥1 pre-inception bar used k·VIX proxy vol
     * (VXN unavailable pre-~2001). Surfaced for UI proxy warning (Wave-C).
     */
    hasProxy?: boolean;
}

// ── Method 'str' (structural) domain types ────────────────────────────────────

/** Resolved implied vol for one date. sigma = annualized IV as a fraction. */
export interface VolPoint {
    sigma: number; // e.g. 0.20 for a 20-vol
    isProxy: boolean; // true when derived from k·VIX (pre-VXN dates)
}

/**
 * Structural covered-call parameters (calibrated by grid/coordinate descent).
 *   beta      — equity-sleeve participation in the base's return
 *   moneyness — call strike offset OTM (fraction, e.g. 0.01 = 1% above spot)
 *   coverage  — fraction of notional written as calls (caps upside above strike)
 *   haircut   — fraction of theoretical BS premium actually captured
 */
export interface StructuralParams {
    beta: number;
    moneyness: number;
    coverage: number;
    haircut: number;
}

/** Output of calibrateStructural — fitted params + in-sample quality. */
export interface StructuralFit {
    params: StructuralParams;
    r2: number; // 1 − SSres/SStot of synth vs actual total-return path, ∈ [0,1]
    trackingError: number; // RMS daily total-return error (≥ 0)
}
