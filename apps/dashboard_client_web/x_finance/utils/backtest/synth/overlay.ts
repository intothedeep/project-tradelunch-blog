// utils/backtest/synth/overlay.ts
// Purpose: the structural covered-call replication core (X2-P2b.6) — the shared
//          per-bar stepper used BOTH to score calibration (over the overlap) and
//          to generate pre-inception PricePoint[] (over the base's earlier path).
// Invariant: pure, deterministic — NO RNG, no I/O, no Date.now().
//
// MODEL (per bar, monthly call roll):
//   price return  rPrice_t = beta·rBase_t − giveback_t
//   giveback_t    = coverage·[g(cumBase_t) − g(cumBase_{t-1})], g(x)=max(0,x−m)
//                   (capped upside: base gains ABOVE the strike are given back on
//                    the covered fraction, accrued within the monthly cycle)
//   premium       booked ONLY on each roll bar as a monthly dividend, priced by
//                 Black–Scholes on a unit spot: premFrac = coverage·haircut·C,
//                 C = bsCall({S:1, K:1+m, sigma_roll, tau, rf}). Scale-invariant
//                 (C ∝ S), so the per-bar premium fraction is independent of the
//                 absolute price level.
//
// NO DOUBLE-COUNTING: the premium is the ONLY income term and is expressed
// purely as the `dividends` field. The `close` chain moves solely by rPrice
// (ex-dividend). Total return recombines them once —
//   rTotal_t = (1+rPrice_t)(1+premFrac_t) − 1 — so premium is never also folded
// into the price path. Downstream the orchestrator does NOT call
// synthesizeDividends for method 'str' (that would re-book income on top).

import type { PricePoint } from '@/types/backtest';
import type { StructuralParams, VolPoint } from './types';
import { bsCall } from './bs';

/** Trading days per monthly option cycle (year fraction to expiry). */
const CYCLE_TAU = 1 / 12;

/** One base return bar consumed by the stepper. */
export interface StructuralBar {
    date: string;
    rBase: number;
}

/** Per-bar structural outputs (ascending, aligned to the input bars). */
export interface StructuralSteps {
    rPrice: number[]; // ex-dividend price return per bar
    premFrac: number[]; // premium as a fraction of spot (nonzero on roll bars)
}

/** Base total returns strictly before realInception, oldest→newest. */
export function preInceptionBars(
    baseSeries: PricePoint[],
    realInception: string
): StructuralBar[] {
    const out: StructuralBar[] = [];
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
 * Run the structural stepper over `bars`, resetting the cycle on the first bar
 * of each calendar month (and the first bar overall). Premium on a roll bar is
 * priced with that bar's sigma from `volByDate`.
 *
 * @throws Error when a roll bar's date has no resolved vol.
 */
export function structuralSteps(
    params: StructuralParams,
    bars: StructuralBar[],
    volByDate: Map<string, VolPoint>,
    rf: number
): StructuralSteps {
    const { beta, moneyness, coverage, haircut } = params;
    const n = bars.length;
    const rPrice = new Array<number>(n);
    const premFrac = new Array<number>(n);
    const g = (x: number): number => (x > moneyness ? x - moneyness : 0);

    let cumBase = 0;
    let seenMonth = '';
    for (let i = 0; i < n; i++) {
        const { date, rBase } = bars[i]!;
        const month = date.slice(0, 7); // 'YYYY-MM'
        let pf = 0;
        if (month !== seenMonth) {
            seenMonth = month;
            cumBase = 0; // new monthly cycle
            const v = volByDate.get(date);
            if (v === undefined) {
                throw new Error(`structuralSteps: no vol for roll bar ${date}`);
            }
            const c = bsCall({
                S: 1,
                K: 1 + moneyness,
                sigma: v.sigma,
                tau: CYCLE_TAU,
                rf,
            });
            pf = coverage * haircut * c;
        }
        const cumPrev = cumBase;
        cumBase = (1 + cumBase) * (1 + rBase) - 1; // compound within cycle
        const giveback = coverage * (g(cumBase) - g(cumPrev));
        rPrice[i] = beta * rBase - giveback;
        premFrac[i] = pf;
    }
    return { rPrice, premFrac };
}

/** Total return per bar = (1+rPrice)(1+premFrac) − 1 (premium-as-dividend). */
export function structuralTotalReturns(steps: StructuralSteps): number[] {
    const { rPrice, premFrac } = steps;
    const out = new Array<number>(rPrice.length);
    for (let i = 0; i < rPrice.length; i++) {
        out[i] = (1 + rPrice[i]!) * (1 + premFrac[i]!) - 1;
    }
    return out;
}

/** Calendar-year gap between two 'YYYY-MM-DD' dates (UTC, DST-safe). */
function calendarYears(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return (b - a) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Annualized synthetic distribution yield over the stepped span. Uses a running
 * unit-anchored close (scale-invariant): Σ dividends / mean(close) / spanYears —
 * mirrors overlap.computeAnnualYield so the calibration target is comparable.
 */
export function structuralYield(
    steps: StructuralSteps,
    dates: string[]
): number {
    const { rPrice, premFrac } = steps;
    const n = rPrice.length;
    if (n < 2) return 0;
    let close = 1;
    let divSum = 0;
    let closeSum = 0;
    for (let i = 0; i < n; i++) {
        close *= 1 + rPrice[i]!;
        divSum += premFrac[i]! * close;
        closeSum += close;
    }
    const meanClose = closeSum / n;
    if (meanClose <= 0) return 0;
    const spanYears = calendarYears(dates[0]!, dates[n - 1]!);
    if (spanYears <= 0) return 0;
    return divSum / meanClose / spanYears;
}

/** Inputs to pre-inception structural generation. */
export interface GenerateStructuralInput {
    params: StructuralParams;
    baseSeries: PricePoint[]; // long-history base, ascending
    volByDate: Map<string, VolPoint>; // vol for every pre-inception bar date
    realInception: string; // first REAL short date (synth covers strictly before)
    realFirstClose: number; // seam anchor — last synth close equals this
    rf: number; // annual risk-free rate for BS premium pricing
}

/**
 * Generate synthetic pre-inception bars for the structural model. Backward
 * price-chain anchored to realFirstClose (zero seam jump); dividends are the
 * mechanically-priced monthly premium; stockSplits = 0. Empty when the base has
 * no history before realInception.
 */
export function generateStructural(
    input: GenerateStructuralInput
): PricePoint[] {
    const { params, baseSeries, volByDate, realInception, realFirstClose, rf } =
        input;
    const bars = preInceptionBars(baseSeries, realInception);
    const n = bars.length;
    if (n === 0) return [];

    const { rPrice, premFrac } = structuralSteps(params, bars, volByDate, rf);

    // Anchor the LAST synthetic close to realFirstClose; recover earlier closes
    // backward via the EX-DIVIDEND price return: close[i-1] = close[i]/(1+rPrice).
    const closes = new Array<number>(n);
    closes[n - 1] = realFirstClose;
    for (let i = n - 1; i > 0; i--) {
        const r = rPrice[i]!;
        closes[i - 1] = r > -1 ? closes[i]! / (1 + r) : closes[i]!;
    }

    const points = new Array<PricePoint>(n);
    for (let i = 0; i < n; i++) {
        points[i] = {
            date: bars[i]!.date,
            close: closes[i]!,
            dividends: Math.max(premFrac[i]! * closes[i]!, 0),
            stockSplits: 0,
        };
    }
    return points;
}
