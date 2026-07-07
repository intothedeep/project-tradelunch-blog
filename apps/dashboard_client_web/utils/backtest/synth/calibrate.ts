// utils/backtest/synth/calibrate.ts
// Purpose: calibrate the structural covered-call params by a DETERMINISTIC
//          two-stage search over the REAL overlap (X2-P2b.5): a coarse global
//          4-D grid to locate the basin, then TWO refining coordinate-descent
//          passes to polish (the restart clears coordinate-coupling stalls).
//          No RNG — same input ⇒ bit-identical output.
//
// OBJECTIVE (minimized on the overlap): composite of
//   trackingError = RMS(actual rShort − synth rTotal)   (path fidelity)
//   yieldGap      = |synth annual yield − realizedYield| (income fidelity)
//   f = trackingError + YIELD_WEIGHT·yieldGap
// The coarse grid avoids the coordinate-descent valley trap (moneyness ↔
// coverage/haircut coupling); coverage is pinned by the give-back kink in
// up-moves, haircut by the premium/yield given coverage, beta by down days
// (where give-back is zero so rPrice = beta·rBase exactly).

import type {
    OverlapResult,
    StructuralFit,
    StructuralParams,
    VolPoint,
} from './types';
import {
    structuralSteps,
    structuralTotalReturns,
    structuralYield,
    type StructuralBar,
} from './overlay';

// Parameter bounds (inclusive) — order fixes the deterministic scan sequence.
const BOUNDS: [keyof StructuralParams, number, number][] = [
    ['beta', 0.85, 1.0],
    ['moneyness', 0.003, 0.025],
    ['coverage', 0.1, 0.4],
    ['haircut', 0.6, 0.95],
];

const YIELD_WEIGHT = 0.1; // yield gap (annual fraction) vs daily tracking error
const COARSE_N = 7; // grid points per dim in the global coarse pass
const LEVELS = 8; // refinement levels (window shrinks each level)
const PASSES = 3; // coordinate sweeps per level
const SCAN_N = 21; // grid points per 1-D refine scan
const WINDOW0 = 0.3; // initial refine window (fraction of each range)
const SHRINK = 0.55; // window multiplier per level

function clamp(x: number, lo: number, hi: number): number {
    return x < lo ? lo : x > hi ? hi : x;
}

/** Composite objective + its tracking-error component for a given param set. */
function evaluate(
    params: StructuralParams,
    bars: StructuralBar[],
    rShort: number[],
    dates: string[],
    volByDate: Map<string, VolPoint>,
    rf: number,
    realizedYield: number
): { f: number; te: number } {
    const steps = structuralSteps(params, bars, volByDate, rf);
    const rTotal = structuralTotalReturns(steps);
    let se = 0;
    for (let i = 0; i < rTotal.length; i++) {
        const d = rShort[i]! - rTotal[i]!;
        se += d * d;
    }
    const te = rTotal.length > 0 ? Math.sqrt(se / rTotal.length) : 0;
    const yieldGap = Math.abs(structuralYield(steps, dates) - realizedYield);
    return { f: te + YIELD_WEIGHT * yieldGap, te };
}

/** In-sample R² of synth total-return vs actual over the overlap, clamped. */
function computeR2(
    params: StructuralParams,
    bars: StructuralBar[],
    rShort: number[],
    volByDate: Map<string, VolPoint>,
    rf: number
): number {
    const rTotal = structuralTotalReturns(
        structuralSteps(params, bars, volByDate, rf)
    );
    const n = rShort.length;
    if (n === 0) return 0;
    let mean = 0;
    for (const v of rShort) mean += v;
    mean /= n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
        const resid = rShort[i]! - rTotal[i]!;
        ssRes += resid * resid;
        ssTot += (rShort[i]! - mean) ** 2;
    }
    let r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    if (r2 < 0) r2 = 0;
    if (r2 > 1) r2 = 1;
    return r2;
}

interface SearchCtx {
    bars: StructuralBar[];
    rShort: number[];
    dates: string[];
    vol: Map<string, VolPoint>;
    rf: number;
    realizedYield: number;
}

function objF(ctx: SearchCtx, p: StructuralParams): number {
    return evaluate(
        p,
        ctx.bars,
        ctx.rShort,
        ctx.dates,
        ctx.vol,
        ctx.rf,
        ctx.realizedYield
    ).f;
}

/** Coarse global grid over all four params — returns the argmin params. */
function coarseGrid(ctx: SearchCtx): StructuralParams {
    const axis = (lo: number, hi: number): number[] =>
        Array.from({ length: COARSE_N }, (_, s) =>
            COARSE_N > 1 ? lo + ((hi - lo) * s) / (COARSE_N - 1) : lo
        );
    const betas = axis(BOUNDS[0]![1], BOUNDS[0]![2]);
    const moneys = axis(BOUNDS[1]![1], BOUNDS[1]![2]);
    const covs = axis(BOUNDS[2]![1], BOUNDS[2]![2]);
    const hairs = axis(BOUNDS[3]![1], BOUNDS[3]![2]);

    let best: StructuralParams = {
        beta: betas[0]!,
        moneyness: moneys[0]!,
        coverage: covs[0]!,
        haircut: hairs[0]!,
    };
    let bestF = Infinity;
    for (const beta of betas)
        for (const moneyness of moneys)
            for (const coverage of covs)
                for (const haircut of hairs) {
                    const p = { beta, moneyness, coverage, haircut };
                    const f = objF(ctx, p);
                    if (f < bestF) {
                        bestF = f;
                        best = p;
                    }
                }
    return best;
}

/** Refining coordinate descent seeded at `start`; window shrinks per level. */
function refine(ctx: SearchCtx, start: StructuralParams): StructuralParams {
    const params: StructuralParams = { ...start };
    let best = objF(ctx, params);
    let window = WINDOW0;
    for (let level = 0; level < LEVELS; level++) {
        for (let pass = 0; pass < PASSES; pass++) {
            for (const [key, lo, hi] of BOUNDS) {
                const half = ((hi - lo) * window) / 2;
                const center = params[key];
                const a = clamp(center - half, lo, hi);
                const b = clamp(center + half, lo, hi);
                let bestVal = params[key];
                for (let s = 0; s < SCAN_N; s++) {
                    const cand =
                        SCAN_N > 1 ? a + ((b - a) * s) / (SCAN_N - 1) : a;
                    const f = objF(ctx, { ...params, [key]: cand });
                    if (f < best) {
                        best = f;
                        bestVal = cand;
                    }
                }
                params[key] = bestVal;
            }
        }
        window *= SHRINK;
    }
    return params;
}

/**
 * Calibrate structural params on the overlap. Deterministic: coarse global grid
 * → two refining coordinate-descent passes. Reports the fitted params, in-sample
 * R², and the RMS daily tracking error at the optimum.
 */
export function calibrateStructural(
    overlap: OverlapResult,
    volOverlap: Map<string, VolPoint>,
    realizedYield: number,
    rf: number
): StructuralFit {
    const ctx: SearchCtx = {
        bars: overlap.bars.map((b) => ({ date: b.date, rBase: b.rBase })),
        rShort: overlap.bars.map((b) => b.rShort),
        dates: overlap.bars.map((b) => b.date),
        vol: volOverlap,
        rf,
        realizedYield,
    };

    // Coarse basin → refine → restart-refine (clears coupling stalls).
    const params = refine(ctx, refine(ctx, coarseGrid(ctx)));

    const te = evaluate(
        params,
        ctx.bars,
        ctx.rShort,
        ctx.dates,
        volOverlap,
        rf,
        realizedYield
    ).te;
    const r2 = computeR2(params, ctx.bars, ctx.rShort, volOverlap, rf);
    return { params, r2, trackingError: te };
}
