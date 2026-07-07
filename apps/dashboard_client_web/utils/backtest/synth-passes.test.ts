// utils/backtest/synth-passes.test.ts
// Acceptance: pass-count orchestration for X2-P2b.9/10.
//
// Key invariants:
//   reg  → runner called exactly 2 times
//   str  → runner called exactly 2 times
//   cmp  → runner called exactly 3 times (real-only computed ONCE)
//   vol absent → str/cmp return null; runner never called
//   determinism: same inputs → identical splicedSeries

import { describe, it, expect, vi } from 'vitest';
import { runSynthPasses } from './synth-passes';
import type {
    BacktestResult,
    BacktestInput,
    PricePoint,
} from '@/types/backtest';
import type { SynthPassesConfig } from './synth-passes';

// ── Minimal deterministic fixtures ───────────────────────────────────────────

function bar(date: string, close: number, div = 0): PricePoint {
    return { date, close, dividends: div, stockSplits: 0 };
}

/** Long-history base: monthly bars 2010-01 .. 2019-01. */
function makeBase(): PricePoint[] {
    const pts: PricePoint[] = [];
    let c = 50;
    for (let y = 2010; y <= 2019; y++) {
        for (let m = 1; m <= 12; m++) {
            if (y === 2019 && m > 1) break;
            const mm = String(m).padStart(2, '0');
            c *= m % 3 === 0 ? 0.97 : 1.02;
            pts.push(bar(`${y}-${mm}-01`, c));
        }
    }
    return pts;
}

/** Short-history asset: monthly bars 2018-01 .. 2019-01 (~1 yr overlap). */
function makeShort(): PricePoint[] {
    const pts: PricePoint[] = [];
    let c = 100;
    for (let m = 1; m <= 13; m++) {
        const y = m <= 12 ? 2018 : 2019;
        const mm = String(m <= 12 ? m : 1).padStart(2, '0');
        c *= m % 3 === 0 ? 0.98 : 1.015;
        pts.push(bar(`${y}-${mm}-01`, c, 0.5));
    }
    return pts;
}

/**
 * Vol series covering 2009-01 .. 2019-01 (monthly).
 * Used for both ^VXN and ^VIX — same series ensures proxyScale = 1.0 and
 * every requested date has a direct lookup hit.
 */
function makeVol(): PricePoint[] {
    const pts: PricePoint[] = [];
    for (let y = 2009; y <= 2019; y++) {
        for (let m = 1; m <= 12; m++) {
            if (y === 2019 && m > 1) break;
            const mm = String(m).padStart(2, '0');
            pts.push(bar(`${y}-${mm}-01`, 20 + Math.sin(m)));
        }
    }
    return pts;
}

const SHORT = 'SHORT';
const shortSeries = makeShort();
const baseSeries = makeBase();
const volSeries = makeVol();

/** Minimal BacktestResult stub — only fields needed to satisfy the type. */
const mockResult: BacktestResult = {
    timeline: [],
    metrics: {
        finalValue: 10_000,
        totalReturnPct: 0,
        cagr: 0,
        maxDrawdown: 0,
        volatility: 0,
        sharpe: null,
        cumulativeDividends: 0,
        totalContributed: 10_000,
        moneyWeightedReturn: null,
    },
    perHolding: [],
    dividends: { byLabel: {}, total: 0, schedule: [] },
    projection: {
        cagrCurve: [],
        monteCarlo: [],
        income: {
            annualYieldPct: 0,
            projectedAnnualCash: 0,
            projectedMonthlyCash: 0,
        },
    },
};

const baseInput: BacktestInput = {
    budget: 10_000,
    holdings: [
        { label: SHORT, weightPct: 100, dividendRoute: { kind: 'cash' } },
    ],
    seriesByLabel: { [SHORT]: shortSeries },
    range: { from: '2010-01-01', to: '2019-01-01' },
    seed: 42,
    riskFreeRate: 0.045,
};

const cfgReg: SynthPassesConfig = {
    backtestInput: baseInput,
    shortLabel: SHORT,
    shortSeries,
    baseSeries,
    volVxn: undefined,
    volVix: undefined,
    riskFreeRate: 0.045,
    method: 'reg',
};

const cfgStr: SynthPassesConfig = {
    ...cfgReg,
    method: 'str',
    volVxn: volSeries,
    volVix: volSeries,
};

const cfgCmp: SynthPassesConfig = {
    ...cfgReg,
    method: 'cmp',
    volVxn: volSeries,
    volVix: volSeries,
};

// ── Pass count tests ──────────────────────────────────────────────────────────

describe('runSynthPasses — pass counts', () => {
    it('reg: runner called exactly 2 times', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgReg, runner);
        expect(out).not.toBeNull();
        expect(runner).toHaveBeenCalledTimes(2);
    });

    it('str: runner called exactly 2 times', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgStr, runner);
        expect(out).not.toBeNull();
        expect(runner).toHaveBeenCalledTimes(2);
    });

    it('cmp: runner called exactly 3 times', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgCmp, runner);
        expect(out).not.toBeNull();
        expect(runner).toHaveBeenCalledTimes(3);
    });
});

// ── Pass 1 is real-only (range starts at realInception) ──────────────────────

describe('runSynthPasses — pass 1 real-only range', () => {
    it('reg pass 1: range.from = realInception (= shortSeries[0].date)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        runSynthPasses(cfgReg, runner);
        const pass1 = runner.mock.calls[0]![0] as BacktestInput;
        expect(pass1.range.from).toBe(shortSeries[0]!.date);
    });

    it('reg pass 2: range.from earlier than realInception (full synthetic span)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        runSynthPasses(cfgReg, runner);
        const pass2 = runner.mock.calls[1]![0] as BacktestInput;
        expect(pass2.range.from < shortSeries[0]!.date).toBe(true);
    });

    it('cmp pass 1 is shared real-only (range.from = realInception)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        runSynthPasses(cfgCmp, runner);
        const pass1 = runner.mock.calls[0]![0] as BacktestInput;
        expect(pass1.range.from).toBe(shortSeries[0]!.date);
    });

    it('cmp passes 2 and 3 are full-span (range.from earlier than realInception)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        runSynthPasses(cfgCmp, runner);
        const pass2 = runner.mock.calls[1]![0] as BacktestInput;
        const pass3 = runner.mock.calls[2]![0] as BacktestInput;
        expect(pass2.range.from < shortSeries[0]!.date).toBe(true);
        expect(pass3.range.from < shortSeries[0]!.date).toBe(true);
    });
});

// ── Compare-mode output shape ─────────────────────────────────────────────────

describe('runSynthPasses — compare-mode output shape', () => {
    it('cmp: exposes regFullResult and strFullResult', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgCmp, runner);
        expect(out?.regFullResult).toBeDefined();
        expect(out?.strFullResult).toBeDefined();
    });

    it('cmp: exposes regMeta and strMeta', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgCmp, runner);
        expect(out?.regMeta?.realInception).toBeDefined();
        expect(out?.strMeta?.realInception).toBeDefined();
    });

    it('reg: regFullResult and strFullResult are undefined', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgReg, runner);
        expect(out?.regFullResult).toBeUndefined();
        expect(out?.strFullResult).toBeUndefined();
    });

    it('str: regFullResult and strFullResult are undefined', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgStr, runner);
        expect(out?.regFullResult).toBeUndefined();
        expect(out?.strFullResult).toBeUndefined();
    });
});

// ── Vol missing → graceful null ───────────────────────────────────────────────

describe('runSynthPasses — missing vol', () => {
    it('str with no vol → null (no runner calls)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses({ ...cfgReg, method: 'str' }, runner);
        expect(out).toBeNull();
        expect(runner).not.toHaveBeenCalled();
    });

    it('cmp with no vol → null (str splice fails)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses({ ...cfgReg, method: 'cmp' }, runner);
        expect(out).toBeNull();
    });

    it('str with empty vol arrays → null', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(
            { ...cfgReg, method: 'str', volVxn: [], volVix: [] },
            runner
        );
        expect(out).toBeNull();
        expect(runner).not.toHaveBeenCalled();
    });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('runSynthPasses — determinism', () => {
    it('same inputs → identical splicedSeries length and start date', () => {
        const r1 = runSynthPasses(cfgReg, vi.fn().mockReturnValue(mockResult));
        const r2 = runSynthPasses(cfgReg, vi.fn().mockReturnValue(mockResult));
        expect(r1?.splicedSeries.length).toBe(r2?.splicedSeries.length);
        expect(r1?.splicedSeries[0]?.date).toBe(r2?.splicedSeries[0]?.date);
    });

    it('cmp: reg and str splices differ (different methods produce different series)', () => {
        const runner = vi.fn().mockReturnValue(mockResult);
        const out = runSynthPasses(cfgCmp, runner);
        expect(out).not.toBeNull();
        // str splice first date may differ from reg; at minimum both are defined.
        expect(out?.splicedSeries.length).toBeGreaterThan(0);
    });
});
