// utils/backtest/metrics.ts
// Purpose: pure metric calculations for backtest engine (Phase X, X.6 / XE.1).
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
 * Modified-Dietz daily simple returns: r_t = (V_t − F_t) / V_{t−1} − 1.
 * F_t is the net external inflow (contribution) on day t.
 * When flows are all 0 the result is identical to computeDailyReturns.
 */
export function computeDailyReturnsWithFlows(
    values: number[],
    flows: number[]
): number[] {
    const out: number[] = [];
    let prev: number | undefined;
    let i = 0;
    for (const v of values) {
        if (prev !== undefined && prev > 0) {
            const f = flows[i] ?? 0;
            out.push((v - f) / prev - 1);
        }
        prev = v;
        i++;
    }
    return out;
}

/**
 * Modified-Dietz daily log returns: ln((V_t − F_t) / V_{t−1}).
 * When flows are all 0 the result is identical to computeLogReturns.
 */
export function computeLogReturnsWithFlows(
    values: number[],
    flows: number[]
): number[] {
    const out: number[] = [];
    let prev: number | undefined;
    let i = 0;
    for (const v of values) {
        if (prev !== undefined && prev > 0) {
            const f = flows[i] ?? 0;
            const adjV = v - f;
            if (adjV > 0) out.push(Math.log(adjV / prev));
        }
        prev = v;
        i++;
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

/**
 * XIRR via bisection — money-weighted return for irregular cash flows.
 *
 * Sign convention (investor perspective):
 *   deposits  → negative amount (cash out of pocket)
 *   final value → positive amount (cash returned to investor)
 *
 * t_i = (date_i − date_0) / 365  (fraction of year from first flow)
 * NPV(r) = Σ amount_i / (1+r)^t_i = 0  → solve for r
 *
 * Bracket: [-0.9999, 100].  Bisection ~100 iterations or |NPV| < 1e-7.
 * Edge cases:
 *   ≤1 flow           → null
 *   all same date     → null
 *   all amounts ≤ 0   → -1.0 (total loss)
 *   bracket endpoints same sign → null (no root in range)
 */
export function computeXirr(
    flows: { date: string; amount: number }[]
): number | null {
    if (flows.length <= 1) return null;

    const first = flows[0];
    if (!first) return null;
    const date0Ms = new Date(first.date + 'T00:00:00Z').getTime();

    // All same date → undefined (no time value of money)
    const allSameDay = flows.every((f) => f.date === first.date);
    if (allSameDay) return null;

    // Total loss: no positive flow (final value = 0)
    if (flows.every((f) => f.amount <= 0)) return -1.0;

    // Precompute time fractions t_i = (date_i - date_0) / 365 days
    const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
    const ts = flows.map((f) => {
        const ms = new Date(f.date + 'T00:00:00Z').getTime() - date0Ms;
        return ms / MS_PER_YEAR;
    });

    function npv(rate: number): number {
        let sum = 0;
        for (let i = 0; i < flows.length; i++) {
            const flow = flows[i];
            const t = ts[i];
            if (flow === undefined || t === undefined) continue;
            sum += flow.amount / Math.pow(1 + rate, t);
        }
        return sum;
    }

    const LO = -0.9999;
    const HI = 100;
    const npvLo = npv(LO);
    const npvHi = npv(HI);

    // No sign change → no root in bracket
    if (Math.sign(npvLo) === Math.sign(npvHi)) return null;

    let a = LO;
    let b = HI;
    for (let iter = 0; iter < 100; iter++) {
        const mid = (a + b) / 2;
        const npvMid = npv(mid);
        if (Math.abs(npvMid) < 1e-7) return mid;
        if (Math.sign(npvMid) === Math.sign(npv(a))) {
            a = mid;
        } else {
            b = mid;
        }
    }
    return (a + b) / 2;
}
