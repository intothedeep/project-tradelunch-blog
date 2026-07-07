// utils/backtest/projection.ts
// Purpose: pure projection functions — CAGR forward curve, seeded Monte Carlo fan,
//          income yield estimate (Phase X, X.6 / XE.1).
// Invariant: NO Math.random() (non-deterministic). Uses mulberry32 seeded PRNG
//            + Box–Muller transform. Same seed + same input ⇒ identical output.
// Note: noUncheckedIndexedAccess is enabled — all array access uses for-of or
//       explicit undefined guards.
// X2-P2.1: mulberry32/standardNormal extracted to prng.ts (byte-identical).

import type { ProjectionResult } from '@/types/backtest';
import { addMonths } from './dateAdd';
import { mulberry32, standardNormal } from './prng';

// ── Linear quantile interpolation ────────────────────────────────────────────
function quantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0;
    const idx = q * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const vLo = sorted[lo] ?? 0;
    const vHi = sorted[hi] ?? 0;
    if (lo === hi) return vLo;
    return vLo * (hi - idx) + vHi * (idx - lo);
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface ProjectionInput {
    vEnd: number; // portfolio value at end of backtest
    cagrValue: number; // annual CAGR fraction
    logReturns: number[]; // daily log returns from backtest timeline (flow-corrected)
    cumulativeDividends: number; // total dividend value over backtest period
    capitalBase: number; // total invested capital (budget + contributions) — yield denominator
    years: number; // actual backtest horizon in years
    endDate: string; // last date of backtest ('YYYY-MM-DD')
    seed: number; // PRNG seed; stored in URL state for shareable fan charts
}

const PROJECTION_YEARS = 10;
const MONTE_CARLO_PATHS = 2000;
const TRADING_DAYS_PER_MONTH = 21;

export function buildProjection(input: ProjectionInput): ProjectionResult {
    const {
        vEnd,
        cagrValue,
        logReturns,
        cumulativeDividends,
        capitalBase,
        years,
        endDate,
        seed,
    } = input;

    const totalMonths = PROJECTION_YEARS * 12;

    // ── CAGR compound curve (monthly points) ─────────────────────────────────
    const cagrCurve: { date: string; value: number }[] = [];
    for (let m = 1; m <= totalMonths; m++) {
        // Guard: negative CAGR produces decay but stays finite; (1+cagr)^t ≥ 0 for cagr ≥ -1
        const factor = Math.pow(Math.max(1 + cagrValue, 0), m / 12);
        cagrCurve.push({ date: addMonths(endDate, m), value: vEnd * factor });
    }

    // ── Monte Carlo fan (seeded, 2000 paths × 120 months) ────────────────────
    // Estimate μ and σ from the realised daily log returns (flow-corrected).
    const n = logReturns.length;
    let muDaily = 0;
    if (n > 0) {
        muDaily = logReturns.reduce((a, b) => a + b, 0) / n;
    }
    let sigmaDaily = 0;
    if (n >= 2) {
        const variance =
            logReturns.reduce((a, b) => a + (b - muDaily) ** 2, 0) / (n - 1);
        sigmaDaily = Math.sqrt(Math.max(variance, 0)); // guard NaN from negative float rounding
    }

    const muMonthly = muDaily * TRADING_DAYS_PER_MONTH;
    const sigmaMonthly = sigmaDaily * Math.sqrt(TRADING_DAYS_PER_MONTH);

    // pathValues[month] stores the value of every path at that month-end.
    const pathValues: number[][] = Array.from(
        { length: totalMonths },
        () => []
    );

    const rand = mulberry32(seed);
    for (let p = 0; p < MONTE_CARLO_PATHS; p++) {
        let v = vEnd;
        for (let m = 0; m < totalMonths; m++) {
            const z = standardNormal(rand);
            v = v * Math.exp(muMonthly + sigmaMonthly * z);
            v = Math.max(v, 0); // guard: exp never produces negative, but be explicit
            const bucket = pathValues[m];
            if (bucket !== undefined) bucket.push(v);
        }
    }

    const monteCarlo: {
        date: string;
        p10: number;
        p50: number;
        p90: number;
    }[] = [];
    for (let m = 0; m < totalMonths; m++) {
        const bucket = pathValues[m] ?? [];
        const sorted = bucket.slice().sort((a, b) => a - b);
        monteCarlo.push({
            date: addMonths(endDate, m + 1),
            p10: quantile(sorted, 0.1),
            p50: quantile(sorted, 0.5),
            p90: quantile(sorted, 0.9),
        });
    }

    // ── Income projection (realised yield, annualised) ────────────────────────
    // Uses capitalBase (total invested) so budget=0 pure-DCA doesn't blow up.
    const safeYears = Math.max(years, 1 / 365);
    const safeCapital = capitalBase > 0 ? capitalBase : 1;
    const annualYieldPct = cumulativeDividends / (safeCapital * safeYears);
    const projectedAnnualCash = safeCapital * annualYieldPct;
    const projectedMonthlyCash = projectedAnnualCash / 12;

    return {
        cagrCurve,
        monteCarlo,
        income: { annualYieldPct, projectedAnnualCash, projectedMonthlyCash },
    };
}
