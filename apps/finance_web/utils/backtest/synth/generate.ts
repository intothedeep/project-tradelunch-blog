// utils/backtest/synth/generate.ts
// Purpose: synthesize pre-inception PricePoint[] for the short asset by applying
//          the two-regime fit + block-bootstrapped residuals to the base asset's
//          pre-inception total returns (X2-P2.4).
// Invariant: pure, deterministic — the ONLY randomness source is prng.ts,
//            seeded by (seed ^ hashLabel(shortLabel)) with a fixed traversal.
//
// SEAM CONTINUITY: prices are chained BACKWARD from realFirstClose so the last
// synthetic bar meets the first real bar with ZERO jump. The last synthetic bar
// close is anchored EQUAL to realFirstClose; earlier closes are recovered by
// dividing out each bar's synthetic total return:
//   close[i-1] = close[i] / (1 + r_synth[i])
// where r_synth[i] is the synthetic total return realized ON bar i vs bar i−1:
//   r_synth[i] = (regime α) + (regime β)·r_base[i] + residual_sample[i].

import type { PricePoint } from '@/types/backtest';
import type { RegressionFit } from './types';
import { mulberry32, hashLabel } from '../prng';

// Block length for the residual block-bootstrap (trading days). A moderate block
// preserves short-run autocorrelation without over-smoothing.
const BLOCK_LEN = 5;

export interface GenerateInput {
    fit: RegressionFit;
    baseSeries: PricePoint[]; // long-history base, ascending
    realInception: string; // first REAL short date — synth covers strictly before
    realFirstClose: number; // short asset's first real close (seam anchor)
    seed: number;
    shortLabel: string;
}

/** Base total returns strictly before realInception, oldest→newest. */
function preInceptionBaseReturns(
    baseSeries: PricePoint[],
    realInception: string
): { date: string; rBase: number }[] {
    const out: { date: string; rBase: number }[] = [];
    for (let i = 1; i < baseSeries.length; i++) {
        const cur = baseSeries[i]!;
        if (cur.date >= realInception) break; // ascending ⇒ done
        const prev = baseSeries[i - 1]!;
        if (prev.close > 0) {
            out.push({
                date: cur.date,
                rBase: (cur.close + cur.dividends) / prev.close - 1,
            });
        }
    }
    return out;
}

/**
 * Block-bootstrap a residual vector of the requested length.
 * Deterministic: fixed traversal order (index 0 → n−1), drawing a fresh random
 * block start whenever the current block is exhausted.
 */
function bootstrapResiduals(
    residuals: number[],
    count: number,
    rng: () => number
): number[] {
    const out: number[] = new Array(count);
    const n = residuals.length;
    if (n === 0) return out.fill(0);
    let blockStart = Math.floor(rng() * n);
    let offset = 0;
    for (let i = 0; i < count; i++) {
        if (offset >= BLOCK_LEN) {
            blockStart = Math.floor(rng() * n);
            offset = 0;
        }
        out[i] = residuals[(blockStart + offset) % n]!;
        offset += 1;
    }
    return out;
}

/**
 * Generate synthetic pre-inception bars. Returns ascending PricePoint[]; empty
 * when there is no base history before realInception.
 */
export function generatePreInception(input: GenerateInput): PricePoint[] {
    const { fit, baseSeries, realInception, realFirstClose, seed, shortLabel } =
        input;

    const preBars = preInceptionBaseReturns(baseSeries, realInception);
    if (preBars.length === 0) return [];

    const rng = mulberry32((seed ^ hashLabel(shortLabel)) >>> 0);
    const resSamples = bootstrapResiduals(fit.residuals, preBars.length, rng);

    // Synthetic total return realized ON each bar (oldest→newest).
    const rSynth: number[] = new Array(preBars.length);
    for (let i = 0; i < preBars.length; i++) {
        const rBase = preBars[i]!.rBase;
        const alpha = rBase >= 0 ? fit.alphaUp : fit.alphaDown;
        const beta = rBase >= 0 ? fit.betaUp : fit.betaDown;
        rSynth[i] = alpha + beta * rBase + resSamples[i]!;
    }

    // Anchor the LAST synthetic bar's close to realFirstClose (zero seam jump),
    // then recover earlier closes backward: close[i-1] = close[i] / (1+rSynth[i]).
    const n = preBars.length;
    const closes: number[] = new Array(n);
    closes[n - 1] = realFirstClose;
    for (let i = n - 1; i > 0; i--) {
        const r = rSynth[i]!;
        // Guard divide-by-zero / total wipeout (r ≤ −1); fall back to flat.
        closes[i - 1] = r > -1 ? closes[i]! / (1 + r) : closes[i]!;
    }

    // Emit PricePoint[]; synthetic bars carry no splits. Dividends are filled by
    // synth/dividends.ts downstream (0 here).
    const points: PricePoint[] = new Array(n);
    for (let i = 0; i < n; i++) {
        points[i] = {
            date: preBars[i]!.date,
            close: closes[i]!,
            dividends: 0,
            stockSplits: 0,
        };
    }
    return points;
}
