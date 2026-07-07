// utils/backtest/synth/index.ts
// Purpose: orchestrate synthetic pre-inception history — overlap → fit →
//          generate → dividends (X2-P2.6). Method-key dispatch; horizon cap.
// Invariant: pure, deterministic — randomness only via generate.ts (prng.ts).
//
// Method dispatch:
//   'reg' — regression proxy (Method 1), implemented here.
//   'str' — throws "not implemented (Phase 2b)". NO silent fallback.
//
// Horizon cap: default synthetic span = 2×(overlap length in years). A deeper
// requested capYears is clamped to that ceiling and `cappedAt` is set to the
// effective (applied) cap in years. A shallower request tightens the span (and
// also sets cappedAt to record the applied bound).

import type { SynthConfig, SynthResult } from './types';
import { alignOverlap } from './overlap';
import { fitRegression } from './fit';
import { generatePreInception } from './generate';
import { synthesizeDividends } from './dividends';

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
 * Build synthetic pre-inception history for the short asset.
 *
 * @throws Error for method 'str' (Phase 2b) or empty overlap (via alignOverlap).
 */
export function buildSyntheticHistory(config: SynthConfig): SynthResult {
    const { short, base, seed, capYears, method, shortLabel } = config;

    if (method === 'str') {
        throw new Error(
            "buildSyntheticHistory: method 'str' not implemented (Phase 2b)"
        );
    }
    if (method !== 'reg') {
        throw new Error(`buildSyntheticHistory: unknown method '${method}'`);
    }

    const overlap = alignOverlap(short, base); // throws on empty overlap
    const fit = fitRegression(overlap);

    const realFirstClose = short[0]!.close;

    let points = generatePreInception({
        fit,
        baseSeries: base,
        realInception: overlap.realInception,
        realFirstClose,
        seed,
        shortLabel,
    });

    // ── Horizon cap ───────────────────────────────────────────────────────────
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

    let cappedAt: number | undefined;
    if (points.length > 0 && effectiveCap > 0) {
        const earliestAllowed = subtractYears(
            overlap.realInception,
            effectiveCap
        );
        const before = points.length;
        points = points.filter((p) => p.date >= earliestAllowed);
        // cappedAt is set whenever the cap actually bounded the span, OR when a
        // deeper capYears was explicitly requested than the default allowed.
        if (
            points.length < before ||
            (capYears !== undefined && capYears > defaultCap)
        ) {
            cappedAt = effectiveCap;
        }
    }

    // ── Synthetic dividends (monthly cadence, flat realized yield) ────────────
    points = synthesizeDividends(points, overlap.shortAnnualYield);

    const result: SynthResult = {
        points,
        realInception: overlap.realInception,
        r2: fit.r2,
    };
    if (cappedAt !== undefined) result.cappedAt = cappedAt;
    return result;
}

// Re-export the type surface for downstream wiring waves.
export type { SynthConfig, SynthResult, SynthMethod } from './types';
export type { OverlapResult, OverlapBar, RegressionFit } from './types';
export { alignOverlap } from './overlap';
export { fitRegression } from './fit';
export { generatePreInception } from './generate';
export { synthesizeDividends } from './dividends';
