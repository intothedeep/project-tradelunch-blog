// utils/backtest/synth/validation-structural.test.ts — X2-P2b.13
// Purpose: STRUCTURAL OVERLAP BACK-TEST VALIDATION — the honesty check for the
//          Method-2 (covered-call) synth pipeline; the analogue of the
//          regression validation.test.ts (X2-P2.12). Prove that
//          alignOverlap → resolveVol → calibrateStructural → generateStructural
//          RECOVERS a KNOWN structural short within stated tolerance, on a fully
//          controlled deterministic fixture (the client test env has NO real
//          market data, so we synthesize a ground truth we can measure against).
//
// METHOD (unit-test analogue of "hold out real JEPQ, synthesize it, compare"):
//   1. Deterministic geometric random walk `base` over ~10y of weekdays.
//   2. VXN/VIX index series through the SAME resolveVol the pipeline uses — VXN
//      starts mid-history so the earliest pre-inception dates fall to the k·VIX
//      proxy (exercises the pre-2001-style gap window).
//   3. A "true structural short" built via the covered-call stepper with KNOWN
//      params over the WHOLE span, booking the BS premium as DIVIDENDS (exactly
//      as generateStructural does). Ground truth = the identical mechanism the
//      pipeline replays, so the ONLY held-out error source is PARAMETER RECOVERY
//      — no model mismatch, no stochastic residual.
//   4. Last ~4y of the short = "real overlap" fed in; earlier ~6y = HELD-OUT
//      truth the pipeline never sees. Calibrate, regenerate held-out, compare.
//
// TOLERANCE BANDS = THE HONESTY CONTRACT (empirical @ seed 42, + honest margin).
// Unlike the regression model the structural model has NO residual, so path
// recovery is TIGHT. Wave-A found beta/moneyness weakly identified (near-flat
// objective on ~0.4% daily moves) while the premium coverage·haircut is SHARPLY
// identified — the bands encode exactly that asymmetry, mirroring X2-P2b.5:
//   coverage·haircut |err| < 0.02  (sharp;   measured 0.003)  premium ← yield+kink
//   beta             |err| < 0.03  (weak-ID; measured 0.001)  band, not the bit
//   moneyness        |err| < 0.005 (weak-ID; measured 0.002)  band, not the bit
//   path RMSE              < 5e-4  (measured 1.5e-4)  only β/moneyness slack
//   held-out yield   |err| < 0.005 (measured 0.001)  premium sharp, vol shared
//   seam / determinism    EXACT    anchor to realFirst / no RNG in method 'str'
//   low-fit r²            < 0.1     noise short can't be fit by the mechanism
// A change that silently degrades recovery must break one of these bands.

import { describe, expect, it } from 'vitest';
import type { PricePoint } from '@/types/backtest';
import { mulberry32, standardNormal } from '../prng';
import { alignOverlap } from './overlap';
import { resolveVol } from './vol';
import { calibrateStructural } from './calibrate';
import {
    generateStructural,
    preInceptionBars,
    structuralSteps,
    type StructuralBar,
} from './overlay';
import type { StructuralParams } from './types';

const TRUE: StructuralParams = {
    beta: 0.92,
    moneyness: 0.012,
    coverage: 0.28,
    haircut: 0.82,
};
const RF = 0.03;
const BASE_MU_D = 0.08 / 252; // base drift ≈ 8%/yr
const BASE_SIG_D = 0.18 / Math.sqrt(252); // ≈18%/yr vol → intra-month rallies clear strike
const N_BARS = 2600; // ~10y of weekdays
const OVERLAP_YEARS = 4;
const VXN_START_IDX = 500; // VXN begins ~2y in → earlier dates use the k·VIX proxy

const pp = (date: string, close: number, dividends = 0): PricePoint => ({
    date,
    close,
    dividends,
    stockSplits: 0,
});

function weekdayDates(start: string, count: number): string[] {
    const out: string[] = [];
    const d = new Date(start + 'T00:00:00Z');
    while (out.length < count) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

// Deterministic geometric random walk base (dividends 0).
function buildBase(seed: number, dates: string[]): PricePoint[] {
    const r = mulberry32(seed >>> 0);
    const out: PricePoint[] = [];
    let close = 100;
    for (let i = 0; i < dates.length; i++) {
        if (i > 0)
            close *= Math.exp(BASE_MU_D + BASE_SIG_D * standardNormal(r));
        out.push(pp(dates[i]!, close));
    }
    return out;
}

// VXN present only from VXN_START_IDX onward; VIX for the full span. Mildly
// time-varying so the k·VIX proxy is a real (not trivially identical) fallback.
function buildVol(dates: string[]): { vxn: PricePoint[]; vix: PricePoint[] } {
    const vxn: PricePoint[] = [];
    const vix: PricePoint[] = [];
    for (let i = 0; i < dates.length; i++) {
        const wobble = 3 * Math.sin(i * 0.02);
        vix.push(pp(dates[i]!, 20 + wobble));
        if (i >= VXN_START_IDX) vxn.push(pp(dates[i]!, 22 + wobble));
    }
    return { vxn, vix };
}

// Base return bars over the whole span (each bar = one dated return observation).
function baseReturnBars(base: PricePoint[]): StructuralBar[] {
    const out: StructuralBar[] = [];
    for (let i = 1; i < base.length; i++) {
        const rBase = base[i]!.close / base[i - 1]!.close - 1;
        out.push({ date: base[i]!.date, rBase });
    }
    return out;
}

interface Fixture {
    base: PricePoint[];
    short: PricePoint[]; // true structural short, whole span (premium as dividends)
    vxn: PricePoint[];
    vix: PricePoint[];
    trueTotalByDate: Map<string, number>; // true short total return per dated bar
}

// Build base + a TRUE structural short via the covered-call stepper on the SAME
// resolved vol the pipeline consumes; the BS premium is booked as DIVIDENDS so
// the realized overlap yield is nonzero — exactly what generateStructural does.
// When `structural` is false the short is pure noise INDEPENDENT of base (the
// low-fit / R²-floor sniff-test fixture).
function buildFixture(seed: number, structural = true): Fixture {
    const dates = weekdayDates('1996-01-02', N_BARS);
    const base = buildBase(seed, dates);
    const { vxn, vix } = buildVol(dates);
    const bars = baseReturnBars(base);
    const volAll = resolveVol(
        bars.map((b) => b.date),
        vxn,
        vix
    );

    const short: PricePoint[] = [pp(dates[0]!, 100)];
    const trueTotalByDate = new Map<string, number>();
    let sClose = 100;
    if (structural) {
        const { rPrice, premFrac } = structuralSteps(TRUE, bars, volAll, RF);
        for (let i = 0; i < bars.length; i++) {
            sClose *= 1 + rPrice[i]!;
            short.push(
                pp(bars[i]!.date, sClose, Math.max(premFrac[i]! * sClose, 0))
            );
            const rt = (1 + rPrice[i]!) * (1 + premFrac[i]!) - 1;
            trueTotalByDate.set(bars[i]!.date, rt);
        }
    } else {
        const rn = mulberry32((seed ^ 0x9e3779b9) >>> 0);
        for (let i = 0; i < bars.length; i++) {
            const rt = 0.004 * standardNormal(rn);
            sClose *= 1 + rt;
            short.push(pp(bars[i]!.date, sClose));
            trueTotalByDate.set(bars[i]!.date, rt);
        }
    }
    return { base, short, vxn, vix, trueTotalByDate };
}

function totalReturns(series: PricePoint[]): { date: string; r: number }[] {
    const out: { date: string; r: number }[] = [];
    for (let i = 1; i < series.length; i++) {
        const p = series[i]!;
        const prev = series[i - 1]!;
        out.push({ date: p.date, r: (p.close + p.dividends) / prev.close - 1 });
    }
    return out;
}
function calendarYears(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return (b - a) / (365.25 * 24 * 3600 * 1000);
}
// Annualized distribution yield (Σ div / mean close / years) — scale-invariant.
function annualYield(series: PricePoint[]): number {
    if (series.length < 2) return 0;
    let divSum = 0;
    let closeSum = 0;
    for (const p of series) {
        divSum += p.dividends;
        closeSum += p.close;
    }
    const meanClose = closeSum / series.length;
    const yrs = calendarYears(series[0]!.date, series[series.length - 1]!.date);
    return meanClose > 0 && yrs > 0 ? divSum / meanClose / yrs : 0;
}

// Run the structural pipeline: hold out the earlier span, keep the last
// OVERLAP_YEARS as the "real" overlap, regenerate the held-out span.
function runPipeline(fx: Fixture) {
    const lastDate = fx.short[fx.short.length - 1]!.date;
    const cutoff = new Date(lastDate + 'T00:00:00Z');
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - OVERLAP_YEARS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const shortOverlap = fx.short.filter((p) => p.date >= cutoffStr);

    const overlap = alignOverlap(shortOverlap, fx.base);
    const volOverlap = resolveVol(
        overlap.bars.map((b) => b.date),
        fx.vxn,
        fx.vix
    );
    const yld = overlap.shortAnnualYield;
    const fit = calibrateStructural(overlap, volOverlap, yld, RF);

    const preDates = preInceptionBars(fx.base, overlap.realInception).map(
        (b) => b.date
    );
    const volPre = resolveVol(preDates, fx.vxn, fx.vix);
    const synth = generateStructural({
        params: fit.params,
        baseSeries: fx.base,
        volByDate: volPre,
        realInception: overlap.realInception,
        realFirstClose: shortOverlap[0]!.close,
        rf: RF,
    });
    return { overlap, fit, synth, shortOverlap, volPre };
}

describe('structural overlap back-test validation (X2-P2b.13)', () => {
    const fx = buildFixture(42);
    const { fit, synth, shortOverlap, volPre } = runPipeline(fx);

    // Align synthetic held-out total returns with the KNOWN true returns by date.
    const synthR: number[] = [];
    const trueR: number[] = [];
    for (const s of totalReturns(synth)) {
        const t = fx.trueTotalByDate.get(s.date);
        if (t !== undefined) {
            synthR.push(s.r);
            trueR.push(t);
        }
    }
    // True held-out series = the fixture's short strictly before real inception.
    const truePre = fx.short.filter((p) => p.date < shortOverlap[0]!.date);

    it('recovers SHARP premium coverage·haircut within 0.02 (tight)', () => {
        const synthPrem = fit.params.coverage * fit.params.haircut;
        const truePrem = TRUE.coverage * TRUE.haircut;
        expect(Math.abs(synthPrem - truePrem)).toBeLessThan(0.02);
    });

    it('recovers beta / moneyness only to a LOOSE band (weakly identified)', () => {
        expect(Math.abs(fit.params.beta - TRUE.beta)).toBeLessThan(0.03);
        const dm = Math.abs(fit.params.moneyness - TRUE.moneyness);
        expect(dm).toBeLessThan(0.005);
        expect(fit.params.beta).toBeGreaterThanOrEqual(0.85);
        expect(fit.params.beta).toBeLessThanOrEqual(1.0);
    });

    it('tracks the held-out total-return path with small RMS error (< 5e-4)', () => {
        // No residual ⇒ held-out error is only the weak β/moneyness slack over
        // ~0.4% daily base moves — well under that scale.
        let se = 0;
        for (let i = 0; i < synthR.length; i++) {
            const d = synthR[i]! - trueR[i]!;
            se += d * d;
        }
        expect(Math.sqrt(se / synthR.length)).toBeLessThan(5e-4);
    });

    it('matches the held-out realized yield within 0.5pp (income fidelity)', () => {
        expect(truePre.length).toBeGreaterThan(0);
        const gap = Math.abs(annualYield(synth) - annualYield(truePre));
        expect(gap).toBeLessThan(0.005);
    });

    it('has ZERO seam jump: synthetic end close === real overlap start close', () => {
        const synthEnd = synth[synth.length - 1]!;
        expect(synthEnd.close).toBe(shortOverlap[0]!.close);
        expect(synthEnd.date < shortOverlap[0]!.date).toBe(true);
    });

    it('exercises the k·VIX proxy on the earliest pre-inception dates', () => {
        // VXN starts mid-history, so the deepest synthetic bars resolve vol via
        // the k·VIX proxy — proves the pre-2001-style gap path is covered.
        expect([...volPre.values()].some((v) => v.isProxy)).toBe(true);
        expect([...volPre.values()].some((v) => !v.isProxy)).toBe(true);
    });

    it('is DETERMINISTIC: same fixture ⇒ byte-identical synthetic output', () => {
        const a = runPipeline(buildFixture(42)).synth;
        const b = runPipeline(buildFixture(42)).synth;
        expect(a).toEqual(b);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('low-fit fixture (base-independent short) yields low r² (sniff-test)', () => {
        const noise = runPipeline(buildFixture(7, /* structural */ false));
        expect(noise.fit.r2).toBeLessThan(0.1);
    });
});
