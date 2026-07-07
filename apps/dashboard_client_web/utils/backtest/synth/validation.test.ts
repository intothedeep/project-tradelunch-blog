// utils/backtest/synth/validation.test.ts — X2-P2.12
// Purpose: OVERLAP BACK-TEST VALIDATION — the honesty check for the regression
//          synth pipeline. Prove that overlap → fit → generate RECOVERS a KNOWN
//          asymmetric relationship within stated tolerance, on a fully
//          controlled deterministic fixture (the client test env has NO real
//          market data, so we synthesize a ground truth we can measure against).
//
// METHOD (unit-test analogue of "hold out real JEPQ, synthesize it, compare"):
//   1. Deterministic geometric random walk `base` over ~10y of weekdays.
//   2. A "true short" built from `base` via a KNOWN asymmetric model
//      (betaUp<betaDown, alphas, monthly dividend yield, N(0,σ²) residual),
//      so its TOTAL return equals the modeled quantity exactly.
//   3. Last ~4y of the short = the "real overlap" fed to the pipeline; the
//      earlier ~6y = the HELD-OUT truth the pipeline never sees.
//   4. alignOverlap → fitRegression → generatePreInception over the held-out
//      span, then compare the SYNTHETIC held-out series to the KNOWN truth.
//
// TOLERANCE BANDS ARE THE HONESTY CONTRACT, NOT ARBITRARY NUMBERS. Each band
// below is justified from the estimator's known error sources (sampling error
// on β/α, and INDEPENDENT residual draws between truth and synth). A future
// change that silently degrades recovery must break one of these bands.

import { describe, expect, it } from 'vitest';
import type { PricePoint } from '@/types/backtest';
import { mulberry32, standardNormal } from '../prng';
import { alignOverlap } from './overlap';
import { fitRegression } from './fit';
import { generatePreInception } from './generate';

// ── Ground-truth model parameters (the relationship we must recover) ──────────
const TRUE = { alphaUp: 0.0002, alphaDown: 0.0, betaUp: 0.5, betaDown: 0.9 };
const RESID_SIGMA = 0.004; // daily residual σ → in-sample R² ≈ 0.75
const DIV_YIELD = 0.09; // JEPQ-like 9% annual, paid monthly
const BASE_MU_D = 0.08 / 252; // base drift ≈ 8%/yr
const BASE_SIG_D = 0.16 / Math.sqrt(252); // base vol ≈ 16%/yr
const N_BARS = 2600; // ~10y of weekdays
const OVERLAP_YEARS = 4;

// ── Deterministic weekday calendar ────────────────────────────────────────────
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

interface Fixture {
    base: PricePoint[]; // long-history proxy (full span), dividends 0
    short: PricePoint[]; // true short (full span), monthly dividends
}

// Build base + a true short that follows the asymmetric model exactly. Two
// independent PRNG streams so `withBeta=false` yields a short UNCORRELATED with
// base (the low-relationship / R²-floor sniff-test fixture).
function buildFixture(seed: number, withBeta = true): Fixture {
    const dates = weekdayDates('2010-01-04', N_BARS);
    const rBase = mulberry32(seed >>> 0);
    const rRes = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const monthlyDiv = DIV_YIELD / 12;

    const base: PricePoint[] = [];
    const short: PricePoint[] = [];
    let bClose = 100;
    let sClose = 100;
    let seenMonth = '';
    for (let i = 0; i < dates.length; i++) {
        const date = dates[i]!;
        let sDiv = 0;
        if (i === 0) {
            base.push({ date, close: bClose, dividends: 0, stockSplits: 0 });
            short.push({ date, close: sClose, dividends: 0, stockSplits: 0 });
            seenMonth = date.slice(0, 7);
            continue;
        }
        // Base: geometric random walk.
        const bPrev = bClose;
        bClose =
            bPrev * Math.exp(BASE_MU_D + BASE_SIG_D * standardNormal(rBase));
        const rb = bClose / bPrev - 1;
        // Short: known asymmetric model on the base total return + N(0,σ²).
        const sys = withBeta
            ? rb >= 0
                ? TRUE.alphaUp + TRUE.betaUp * rb
                : TRUE.alphaDown + TRUE.betaDown * rb
            : 0; // no-beta: short is pure noise, independent of base
        const rShortTrue = sys + RESID_SIGMA * standardNormal(rRes);
        // Monthly dividend on the first bar of a new calendar month, sized off
        // the PRIOR close, so total return = rShortTrue EXACTLY:
        //   (close_i + div_i) / close_{i-1} − 1 == rShortTrue.
        const month = date.slice(0, 7);
        if (month !== seenMonth) {
            sDiv = sClose * monthlyDiv;
            seenMonth = month;
        }
        const sPrev = sClose;
        sClose = sPrev * (1 + rShortTrue) - sDiv;
        base.push({ date, close: bClose, dividends: 0, stockSplits: 0 });
        short.push({ date, close: sClose, dividends: sDiv, stockSplits: 0 });
    }
    return { base, short };
}

// ── Metric helpers (pure) ─────────────────────────────────────────────────────
/** Total returns of a series, oldest→newest: (close+div)/prevClose − 1. */
function totalReturns(series: PricePoint[]): { date: string; r: number }[] {
    const out: { date: string; r: number }[] = [];
    for (let i = 1; i < series.length; i++) {
        const p = series[i]!;
        const prev = series[i - 1]!;
        out.push({ date: p.date, r: (p.close + p.dividends) / prev.close - 1 });
    }
    return out;
}

function mean(xs: number[]): number {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs: number[]): number {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function corr(xs: number[], ys: number[]): number {
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i++) {
        const dx = xs[i]! - mx;
        const dy = ys[i]! - my;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    return sxy / Math.sqrt(sxx * syy);
}
/** Annualized CAGR from a total-return vector over a calendar-year span. */
function cagr(rs: number[], years: number): number {
    const growth = rs.reduce((acc, r) => acc * (1 + r), 1);
    return growth ** (1 / years) - 1;
}
function calendarYears(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00Z').getTime();
    const b = new Date(to + 'T00:00:00Z').getTime();
    return (b - a) / (365.25 * 24 * 3600 * 1000);
}

// Run the pipeline on a fixture: hold out the earlier span, keep the last
// OVERLAP_YEARS as the "real" overlap, synthesize the held-out span.
function runPipeline(fx: Fixture) {
    const lastDate = fx.short[fx.short.length - 1]!.date;
    const cutoff = new Date(lastDate + 'T00:00:00Z');
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - OVERLAP_YEARS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const shortOverlap = fx.short.filter((p) => p.date >= cutoffStr);

    const overlap = alignOverlap(shortOverlap, fx.base);
    const fit = fitRegression(overlap);
    const synth = generatePreInception({
        fit,
        baseSeries: fx.base,
        realInception: overlap.realInception,
        realFirstClose: shortOverlap[0]!.close,
        seed: 12345,
        shortLabel: 'JEPQ',
    });
    return { overlap, fit, synth, shortOverlap };
}

describe('synth overlap back-test validation (X2-P2.12)', () => {
    const fx = buildFixture(42);
    const { fit, synth, shortOverlap } = runPipeline(fx);

    // Align synthetic held-out total returns with the KNOWN true returns by date.
    const synthRet = totalReturns(synth); // div=0 ⇒ price return = total return
    const trueByDate = new Map(
        totalReturns(fx.short).map((x) => [x.date, x.r])
    );
    const synthR: number[] = [];
    const trueR: number[] = [];
    for (const s of synthRet) {
        const t = trueByDate.get(s.date);
        if (t !== undefined) {
            synthR.push(s.r);
            trueR.push(t);
        }
    }

    it('recovers the fit with sensible R² and asymmetric betas (βUp<βDown)', () => {
        // Sanity: the fit itself must see a strong, asymmetric relationship.
        expect(fit.r2).toBeGreaterThan(0.6);
        expect(fit.betaUp).toBeLessThan(fit.betaDown);
        expect(fit.betaUp).toBeCloseTo(TRUE.betaUp, 1);
        expect(fit.betaDown).toBeCloseTo(TRUE.betaDown, 1);
    });

    it('recovers annualized vol within [0.7, 1.3] (BAND: β/σ sampling error)', () => {
        // The synth reproduces vol from fitted β·rBase + block-bootstrapped
        // residuals. β is estimated (sampling error) and residual variance is
        // resampled, so a ±30% band is the honest tolerance — tighter would be
        // dishonest about estimation noise.
        const ratio = std(synthR) / std(trueR);
        expect(ratio).toBeGreaterThanOrEqual(0.7);
        expect(ratio).toBeLessThanOrEqual(1.3);
    });

    it('recovers return correlation ≥ 0.5 (BAND: residuals are INDEPENDENT)', () => {
        // Synth and truth share the base-driven systematic component but draw
        // INDEPENDENT residuals; the correlation ceiling is ≈R² (~0.75), so a
        // ≥0.5 floor is loose-but-meaningful — it fails if the systematic
        // recovery collapses.
        expect(corr(synthR, trueR)).toBeGreaterThanOrEqual(0.5);
    });

    it('recovers CAGR within ±0.03 abs (BAND: α error + residual drift)', () => {
        // CAGR error is driven by α sampling error and the finite-sample mean of
        // the bootstrapped residuals (which need not be exactly 0 over the
        // held-out span). ±3pp annualized is the stated honest band.
        const years = calendarYears(
            synth[0]!.date,
            synth[synth.length - 1]!.date
        );
        const synthCagr = cagr(synthR, years);
        const trueCagr = cagr(trueR, years);
        expect(Math.abs(synthCagr - trueCagr)).toBeLessThanOrEqual(0.03);
    });

    it('has ZERO seam jump: synthetic end close === real overlap start close', () => {
        // Deterministic construction (generate anchors the last synth bar to
        // realFirstClose), so this is EXACT equality, not a band.
        const synthEnd = synth[synth.length - 1]!;
        expect(synthEnd.close).toBe(shortOverlap[0]!.close);
        // And the synthetic span is strictly BEFORE the real inception.
        expect(synthEnd.date < shortOverlap[0]!.date).toBe(true);
    });

    it('is DETERMINISTIC: same seed ⇒ byte-identical synthetic output', () => {
        const a = runPipeline(buildFixture(42)).synth;
        const b = runPipeline(buildFixture(42)).synth;
        expect(a).toEqual(b);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('low-relationship fixture yields low r2 (R²-floor sniff-test)', () => {
        // A short built with NO beta (pure noise, independent of base) must fit
        // near-zero R² — proves the pipeline does not manufacture a relationship.
        const noise = runPipeline(buildFixture(7, /* withBeta */ false));
        expect(noise.fit.r2).toBeLessThan(0.1);
    });
});
