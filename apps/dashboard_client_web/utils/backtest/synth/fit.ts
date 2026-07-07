// utils/backtest/synth/fit.ts
// Purpose: asymmetric two-regime OLS of the short asset onto the base asset
//          (X2-P2.3). Captures covered-call capped upside (β_up < β_down).
// Invariant: pure OLS — deterministic, no RNG, no I/O.
//
// DESIGN — separate intercept AND slope per regime:
//   base-up  (rBase ≥ 0): rShort = alphaUp   + betaUp   · rBase
//   base-down (rBase < 0): rShort = alphaDown + betaDown · rBase
// Each regime is an independent simple-OLS fit on its own subset. R² is computed
// over the POOLED fitted values (both regimes) against the full short series, so
// it reflects the joint model's explanatory power. Residuals are (actual −
// fitted) in overlap order (oldest→newest) for downstream block-bootstrap.

import type { OverlapResult, RegressionFit } from './types';

interface SimpleOls {
    alpha: number;
    beta: number;
}

/** Ordinary least squares slope+intercept for y = alpha + beta·x. */
function simpleOls(xs: number[], ys: number[]): SimpleOls {
    const n = xs.length;
    if (n === 0) return { alpha: 0, beta: 0 };
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
        sx += xs[i]!;
        sy += ys[i]!;
    }
    const mx = sx / n;
    const my = sy / n;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i]! - mx;
        sxx += dx * dx;
        sxy += dx * (ys[i]! - my);
    }
    // Degenerate x (all identical) ⇒ zero slope, intercept = mean(y).
    const beta = sxx > 0 ? sxy / sxx : 0;
    const alpha = my - beta * mx;
    return { alpha, beta };
}

/**
 * Fit the asymmetric two-regime model and return coefficients, R², residuals.
 */
export function fitRegression(overlap: OverlapResult): RegressionFit {
    const { bars } = overlap;

    // Partition into regimes.
    const upX: number[] = [];
    const upY: number[] = [];
    const downX: number[] = [];
    const downY: number[] = [];
    for (const b of bars) {
        if (b.rBase >= 0) {
            upX.push(b.rBase);
            upY.push(b.rShort);
        } else {
            downX.push(b.rBase);
            downY.push(b.rShort);
        }
    }

    const up = simpleOls(upX, upY);
    const down = simpleOls(downX, downY);

    // Pooled fitted values + residuals (overlap order) + R² over the full set.
    let meanY = 0;
    for (const b of bars) meanY += b.rShort;
    meanY /= bars.length;

    const residuals: number[] = new Array(bars.length);
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i]!;
        const fitted =
            b.rBase >= 0
                ? up.alpha + up.beta * b.rBase
                : down.alpha + down.beta * b.rBase;
        const resid = b.rShort - fitted;
        residuals[i] = resid;
        ssRes += resid * resid;
        ssTot += (b.rShort - meanY) ** 2;
    }
    // Guard degenerate variance; clamp R² into [0, 1].
    let r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    if (r2 < 0) r2 = 0;
    if (r2 > 1) r2 = 1;

    return {
        alphaUp: up.alpha,
        alphaDown: down.alpha,
        betaUp: up.beta,
        betaDown: down.beta,
        r2,
        residuals,
    };
}
