// utils/backtest/synth/index.ts
// Purpose: orchestrate synthetic pre-inception history — overlap → fit →
//          generate → dividends. Method-key dispatch; shared horizon cap.
// Invariant: pure, deterministic. Method 'reg' randomness only via generate.ts
//            (prng.ts); method 'str' uses NO RNG at all.
//
// Method dispatch:
//   'reg' — regression proxy (Method 1, X2-P2a): two-regime OLS + bootstrap.
//   'str' — structural covered-call synth (Method 2, X2-P2b): mechanical BS
//           premium + capped-upside replication on the base's ACTUAL path.
//
// Horizon cap (both methods): default synthetic span = 2×(overlap length in
// years). A deeper requested capYears is clamped to that ceiling and `cappedAt`
// is set to the effective (applied) cap in years. A shallower request tightens
// the span (and also sets cappedAt to record the applied bound).
// `fullSpan` (config) bypasses the cap entirely — synthesize back to the base
// asset's earliest bar. Opt-in; used by the backtest feature so the date-range
// floor matches the chosen base's inception.

import type { PricePoint } from '@/types/backtest';
import type { OverlapResult, SynthConfig, SynthResult } from './types';
import { alignOverlap } from './overlap';
import { fitRegression } from './fit';
import { generatePreInception } from './generate';
import { synthesizeDividends } from './dividends';
import { resolveVol } from './vol';
import { calibrateStructural } from './calibrate';
import { generateStructural, preInceptionBars } from './overlay';

/** Calendar-year gap between two 'YYYY-MM-DD' dates (UTC, DST-safe). */
function calendarYears(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return (b - a) / (365.25 * 24 * 3600 * 1000);
}

/** 'YYYY-MM-DD' string `years` before `date` (UTC, DST-safe). */
function subtractYears(date: string, years: number): string {
    const d = new Date(date + 'T00:00:00Z');
    // Whole-year step keeps the calendar anchor stable; fractional part in days.
    const whole = Math.floor(years);
    const fracDays = Math.round((years - whole) * 365.25);
    d.setUTCFullYear(d.getUTCFullYear() - whole);
    d.setUTCDate(d.getUTCDate() - fracDays);
    return d.toISOString().slice(0, 10);
}

/**
 * Clamp the synthetic span to 2×overlap (or a shallower explicit capYears).
 * Shared by both methods so the horizon boundary is identical. Returns the
 * (possibly filtered) points and the effective cap when it actually bounded.
 */
function applyHorizonCap(
    points: PricePoint[],
    overlap: OverlapResult,
    capYears: number | undefined,
    fullSpan: boolean | undefined
): { points: PricePoint[]; cappedAt?: number } {
    // fullSpan opts out of the horizon cap entirely — keep the full base
    // pre-inception span (used by the backtest feature so the picker floor
    // reaches the base's inception).
    if (fullSpan) return { points };
    const overlapBars = overlap.bars;
    const overlapYears =
        overlapBars.length >= 2
            ? calendarYears(
                  overlapBars[0]!.date,
                  overlapBars[overlapBars.length - 1]!.date
              )
            : 0;
    const defaultCap = 2 * overlapYears;
    const effectiveCap =
        capYears !== undefined ? Math.min(capYears, defaultCap) : defaultCap;

    if (points.length === 0 || effectiveCap <= 0) return { points };

    const earliestAllowed = subtractYears(overlap.realInception, effectiveCap);
    const before = points.length;
    const filtered = points.filter((p) => p.date >= earliestAllowed);
    // cappedAt is set whenever the cap actually bounded the span, OR when a
    // deeper capYears was explicitly requested than the default allowed.
    if (
        filtered.length < before ||
        (capYears !== undefined && capYears > defaultCap)
    ) {
        return { points: filtered, cappedAt: effectiveCap };
    }
    return { points: filtered };
}

/** Method 1 (regression proxy): two-regime OLS + block-bootstrap residuals. */
function buildRegression(config: SynthConfig): SynthResult {
    const { short, base, seed, capYears, fullSpan, shortLabel } = config;

    const overlap = alignOverlap(short, base); // throws on empty overlap
    const fit = fitRegression(overlap);
    const realFirstClose = short[0]!.close;

    const raw = generatePreInception({
        fit,
        baseSeries: base,
        realInception: overlap.realInception,
        realFirstClose,
        seed,
        shortLabel,
    });

    const capped = applyHorizonCap(raw, overlap, capYears, fullSpan);
    const points = synthesizeDividends(capped.points, overlap.shortAnnualYield);

    const result: SynthResult = {
        points,
        realInception: overlap.realInception,
        r2: fit.r2,
    };
    if (capped.cappedAt !== undefined) result.cappedAt = capped.cappedAt;
    return result;
}

/**
 * Method 2 (structural covered-call): calibrate params on the overlap, then
 * mechanically replicate the covered-call sleeve on the base's earlier path.
 * Dividends are the BS-priced monthly premium (booked inside generateStructural)
 * — so synthesizeDividends is intentionally NOT applied (no income double-count).
 */
function buildStructural(config: SynthConfig): SynthResult {
    const { short, base, capYears, fullSpan, volVxn, volVix, riskFreeRate } =
        config;
    if (!volVxn || !volVix) {
        throw new Error(
            "buildSyntheticHistory: method 'str' requires volVxn + volVix inputs"
        );
    }
    const rf = riskFreeRate ?? 0.04;

    const overlap = alignOverlap(short, base); // throws on empty overlap
    const overlapDates = overlap.bars.map((b) => b.date);
    const volOverlap = resolveVol(overlapDates, volVxn, volVix);
    const fit = calibrateStructural(
        overlap,
        volOverlap,
        overlap.shortAnnualYield,
        rf
    );

    const preDates = preInceptionBars(base, overlap.realInception).map(
        (b) => b.date
    );
    const volPre = resolveVol(preDates, volVxn, volVix);
    // Detect proxy vol usage (k·VIX fallback, pre-VXN dates) for UI warning.
    const hasProxy = [...volPre.values()].some((v) => v.isProxy);

    const raw = generateStructural({
        params: fit.params,
        baseSeries: base,
        volByDate: volPre,
        realInception: overlap.realInception,
        realFirstClose: short[0]!.close,
        rf,
    });

    const capped = applyHorizonCap(raw, overlap, capYears, fullSpan);
    const result: SynthResult = {
        points: capped.points,
        realInception: overlap.realInception,
        r2: fit.r2,
    };
    if (capped.cappedAt !== undefined) result.cappedAt = capped.cappedAt;
    if (hasProxy) result.hasProxy = true;
    return result;
}

/**
 * Build synthetic pre-inception history for the short asset.
 *
 * @throws Error for empty overlap (via alignOverlap), unknown method, or (for
 *   method 'str') missing vol inputs.
 */
export function buildSyntheticHistory(config: SynthConfig): SynthResult {
    if (config.method === 'reg') return buildRegression(config);
    if (config.method === 'str') return buildStructural(config);
    throw new Error(
        `buildSyntheticHistory: unknown method '${config.method as string}'`
    );
}

// Re-export the type surface for downstream wiring waves.
export type { SynthConfig, SynthResult, SynthMethod } from './types';
export type { OverlapResult, OverlapBar, RegressionFit } from './types';
export type { VolPoint, StructuralParams, StructuralFit } from './types';
export { alignOverlap } from './overlap';
export { fitRegression } from './fit';
export { generatePreInception } from './generate';
export { synthesizeDividends } from './dividends';
export { bsCall, normCdf } from './bs';
export { resolveVol } from './vol';
export { calibrateStructural } from './calibrate';
export { generateStructural, structuralSteps } from './overlay';
