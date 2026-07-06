// utils/backtest/metrics.ts
// Purpose: pure metric calculations for backtest engine (Phase X, X.6).
// Invariant: deterministic, no hidden state, no side effects, no I/O.
// Note: noUncheckedIndexedAccess is enabled — all array access uses for-of or
//       explicit undefined guards to satisfy strict TypeScript.

/**
 * Compound Annual Growth Rate.
 * Returns 0 when inputs are degenerate (zero start value, non-positive years).
 */
export function computeCagr(
    vStart: number,
    vEnd: number,
    years: number
): number {
    if (years <= 0 || vStart <= 0 || vEnd < 0) return 0;
    return Math.pow(vEnd / vStart, 1 / years) - 1;
}

/**
 * Maximum drawdown over a value series.
 * Returns a non-positive fraction, e.g. -0.35 = –35% drawdown.
 * Returns 0 when the series is monotonically non-decreasing or length < 2.
 */
export function computeMaxDrawdown(values: number[]): number {
    if (values.length < 2) return 0;
    // Avoid index access (noUncheckedIndexedAccess): use for-of with running peak.
    let peak = -Infinity;
    let mdd = 0;
    for (const v of values) {
        if (v > peak) peak = v;
        if (peak > 0) {
            const dd = v / peak - 1;
            if (dd < mdd) mdd = dd;
        }
    }
    return mdd;
}

/**
 * Daily simple returns: (v[i] − v[i−1]) / v[i−1].
 * Uses for-of with a trailing-prev pattern to avoid index access.
 */
export function computeDailyReturns(values: number[]): number[] {
    const out: number[] = [];
    let prev: number | undefined;
    for (const v of values) {
        if (prev !== undefined && prev > 0) {
            out.push(v / prev - 1);
        }
        prev = v;
    }
    return out;
}

/**
 * Daily log returns: ln(v[i] / v[i−1]).
 * Used by the Monte Carlo estimator.
 */
export function computeLogReturns(values: number[]): number[] {
    const out: number[] = [];
    let prev: number | undefined;
    for (const v of values) {
        if (prev !== undefined && prev > 0 && v > 0) {
            out.push(Math.log(v / prev));
        }
        prev = v;
    }
    return out;
}

/**
 * Sample standard deviation (Bessel-corrected, n−1).
 * Returns 0 when length < 2.
 */
export function sampleStdev(xs: number[]): number {
    if (xs.length < 2) return 0;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance =
        xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
    return Math.sqrt(variance);
}

/**
 * Annualised volatility = daily stdev × √252.
 */
export function computeVolatility(dailyReturns: number[]): number {
    return sampleStdev(dailyReturns) * Math.sqrt(252);
}

/**
 * Sharpe ratio = (cagr − riskFreeRate) / volatility.
 * Returns null when volatility = 0 (division-by-zero guard).
 */
export function computeSharpe(
    cagrValue: number,
    volatility: number,
    riskFreeRate: number
): number | null {
    if (volatility === 0) return null;
    return (cagrValue - riskFreeRate) / volatility;
}
