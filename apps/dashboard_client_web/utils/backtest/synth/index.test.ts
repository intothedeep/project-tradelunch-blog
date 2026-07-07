// index.test.ts — X2-P2.6 orchestrator
import { describe, expect, it } from 'vitest';
import { buildSyntheticHistory } from './index';
import type { PricePoint } from '@/types/backtest';
import type { SynthConfig } from './types';

function bar(date: string, close: number, dividends = 0): PricePoint {
    return { date, close, dividends, stockSplits: 0 };
}

// Monthly base bars 2010-01 .. 2019-01 (long history).
function makeBase(): PricePoint[] {
    const pts: PricePoint[] = [];
    let close = 50;
    for (let y = 2010; y <= 2019; y++) {
        for (let m = 1; m <= 12; m++) {
            if (y === 2019 && m > 1) break;
            const mm = String(m).padStart(2, '0');
            close *= m % 3 === 0 ? 0.97 : 1.02; // mild up/down mix for regimes
            pts.push(bar(`${y}-${mm}-01`, close));
        }
    }
    return pts;
}

// Short: monthly 2018-01 .. 2019-01 → ~1 year overlap.
function makeShort(): PricePoint[] {
    const pts: PricePoint[] = [];
    let close = 100;
    for (let m = 1; m <= 13; m++) {
        const y = m <= 12 ? 2018 : 2019;
        const mm = String(m <= 12 ? m : 1).padStart(2, '0');
        close *= m % 3 === 0 ? 0.98 : 1.015;
        pts.push(bar(`${y}-${mm}-01`, close, 0.5));
    }
    return pts;
}

const baseCfg: Omit<SynthConfig, 'capYears'> = {
    short: makeShort(),
    base: makeBase(),
    seed: 3,
    method: 'reg',
    shortLabel: 'JEPQ',
};

// Overlap runs 2018-02-01 .. 2019-01-01 ≈ 0.915yr → default cap ≈ 1.83yr →
// earliest synthetic bar ≈ 2016-04-01 (first base bar on/after the cap floor).
const EXPECTED_EARLIEST = '2016-04-01';

describe('buildSyntheticHistory', () => {
    it("method 'str' throws (not implemented)", () => {
        expect(() =>
            buildSyntheticHistory({ ...baseCfg, method: 'str' })
        ).toThrow(/not implemented \(Phase 2b\)/);
    });

    it('default span = 2×overlap (cap boundary exact)', () => {
        const r = buildSyntheticHistory(baseCfg);
        expect(r.points[0]!.date).toBe(EXPECTED_EARLIEST);
        // No synthetic bar predates the 2×overlap floor.
        for (const p of r.points) {
            expect(p.date >= EXPECTED_EARLIEST).toBe(true);
            expect(p.date < '2018-01-01').toBe(true);
        }
        expect(r.realInception).toBe('2018-01-01');
    });

    it('deeper capYears request clamps + sets cappedAt', () => {
        const r = buildSyntheticHistory({ ...baseCfg, capYears: 8 });
        expect(r.cappedAt).toBeDefined();
        // effective cap = min(8, 2×overlap) ≈ 1.83 → same floor as default.
        expect(r.points[0]!.date).toBe(EXPECTED_EARLIEST);
        expect(r.cappedAt!).toBeLessThan(3);
        expect(r.cappedAt!).toBeGreaterThan(1);
    });

    it('seam continuity: last synth close chains to first real close', () => {
        const r = buildSyntheticHistory(baseCfg);
        const realFirstClose = makeShort()[0]!.close;
        expect(r.points[r.points.length - 1]!.close).toBeCloseTo(
            realFirstClose,
            8
        );
    });

    it('attaches monthly synthetic dividends (yield ≥ 0)', () => {
        const r = buildSyntheticHistory(baseCfg);
        const paying = r.points.filter((p) => p.dividends > 0);
        expect(paying.length).toBeGreaterThan(0);
        for (const p of r.points) expect(p.dividends).toBeGreaterThanOrEqual(0);
    });

    it('reports r2 ∈ [0,1]', () => {
        const r = buildSyntheticHistory(baseCfg);
        expect(r.r2).toBeGreaterThanOrEqual(0);
        expect(r.r2).toBeLessThanOrEqual(1);
    });

    it('is pure / deterministic', () => {
        expect(buildSyntheticHistory(baseCfg)).toEqual(
            buildSyntheticHistory(baseCfg)
        );
    });
});
