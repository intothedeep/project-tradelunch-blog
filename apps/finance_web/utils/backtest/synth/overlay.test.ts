// overlay.test.ts — X2-P2b.6 structural generation + str integration
import { describe, expect, it } from 'vitest';
import { generateStructural } from './overlay';
import { buildSyntheticHistory } from './index';
import type { PricePoint } from '@/types/backtest';
import type { StructuralParams, VolPoint } from './types';

function bar(date: string, close: number, dividends = 0): PricePoint {
    return { date, close, dividends, stockSplits: 0 };
}

const RF = 0.03;
const PARAMS: StructuralParams = {
    beta: 0.95,
    moneyness: 0.01,
    coverage: 0.3,
    haircut: 0.8,
};

/** volByDate constant-sigma map for a set of dates. */
function volMap(dates: string[], sigma: number): Map<string, VolPoint> {
    return new Map(dates.map((d) => [d, { sigma, isProxy: false }]));
}

// ── generateStructural: shape, seam, cadence, determinism ────────────────────
describe('generateStructural', () => {
    // Base: monthly 2018-01 .. 2020-01, mild drift; short inception 2020-01-01.
    const base: PricePoint[] = [];
    {
        let c = 100;
        for (let m = 0; m < 25; m++) {
            const y = 2018 + Math.floor(m / 12);
            const mm = String((m % 12) + 1).padStart(2, '0');
            c *= m % 4 === 0 ? 0.99 : 1.015;
            base.push(bar(`${y}-${mm}-01`, c));
        }
    }
    const realInception = '2020-01-01';
    const realFirstClose = 42;
    const dates = base.map((b) => b.date);
    const input = {
        params: PARAMS,
        baseSeries: base,
        volByDate: volMap(dates, 0.25),
        realInception,
        realFirstClose,
        rf: RF,
    };

    it('covers only pre-inception dates, ascending, splits=0', () => {
        const pts = generateStructural(input);
        expect(pts.length).toBeGreaterThan(0);
        for (const p of pts) {
            expect(p.date < realInception).toBe(true);
            expect(p.stockSplits).toBe(0);
        }
        const ds = pts.map((p) => p.date);
        expect([...ds].sort()).toEqual(ds);
    });

    it('seam continuity: last synthetic close equals realFirstClose', () => {
        const pts = generateStructural(input);
        expect(pts[pts.length - 1]!.close).toBeCloseTo(realFirstClose, 10);
    });

    it('premium booked as dividends ≥ 0 on a monthly cadence', () => {
        const pts = generateStructural(input);
        const paying = pts.filter((p) => p.dividends > 0);
        expect(paying.length).toBeGreaterThan(0);
        // At most one paying bar per calendar month (monthly roll).
        const months = new Set(paying.map((p) => p.date.slice(0, 7)));
        expect(months.size).toBe(paying.length);
        for (const p of pts) expect(p.dividends).toBeGreaterThanOrEqual(0);
    });

    it('is deterministic (RNG 0 — bit-identical on repeat)', () => {
        expect(generateStructural(input)).toEqual(generateStructural(input));
    });

    it('empty when base has no pre-inception history', () => {
        expect(
            generateStructural({
                ...input,
                baseSeries: [bar('2020-01-01', 42), bar('2020-02-01', 43)],
            })
        ).toEqual([]);
    });
});

// ── Crash-fixture: structural drawdown ≈ base minus the premium cushion ───────
describe('generateStructural — crash signature', () => {
    it('cushions drawdown vs the base by roughly the collected premium', () => {
        // Base crashes ~40% over 2019, high implied vol → fat premiums.
        const base: PricePoint[] = [];
        let c = 100;
        const rets = [
            0.01, -0.12, -0.1, -0.08, 0.02, -0.09, -0.07, 0.01, -0.05, -0.04,
            0.03, -0.03,
        ];
        base.push(bar('2018-12-01', c));
        rets.forEach((r, i) => {
            c *= 1 + r;
            const mm = String(i + 1).padStart(2, '0');
            base.push(bar(`2019-${mm}-01`, c));
        });
        base.push(bar('2020-01-01', c)); // inception anchor bar
        const dates = base.map((b) => b.date);

        const pts = generateStructural({
            params: PARAMS,
            baseSeries: base,
            volByDate: volMap(dates, 0.6), // crash-level vol
            realInception: '2020-01-01',
            realFirstClose: c,
            rf: RF,
        });

        // Base price drawdown over the synthetic window.
        const preBase = base.filter((b) => b.date < '2020-01-01');
        let peak = -Infinity;
        let baseDd = 0;
        for (const b of preBase) {
            peak = Math.max(peak, b.close);
            baseDd = Math.min(baseDd, b.close / peak - 1);
        }

        // Synthetic TOTAL-return drawdown (price + booked premium reinvested).
        let idxVal = 1;
        let prevClose = pts[0]!.close;
        let synPeak = idxVal;
        let synDd = 0;
        let premiumSum = 0;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i]!;
            const rTot = (p.close + p.dividends) / prevClose - 1;
            idxVal *= 1 + rTot;
            prevClose = p.close;
            premiumSum += p.dividends;
            synPeak = Math.max(synPeak, idxVal);
            synDd = Math.min(synDd, idxVal / synPeak - 1);
        }

        expect(premiumSum).toBeGreaterThan(0); // premiums were collected
        expect(synDd).toBeLessThan(0); // still a real drawdown (not erased)
        // Structural signature: cushioned — synth draws down LESS than the base.
        expect(synDd).toBeGreaterThan(baseDd);
    });
});

// ── Full method:'str' orchestration via buildSyntheticHistory ─────────────────
describe("buildSyntheticHistory method:'str'", () => {
    // Long base 2015-01 .. 2019-01 monthly; short 2018-01 .. 2019-01.
    function makeBase(): PricePoint[] {
        const pts: PricePoint[] = [];
        let c = 50;
        for (let y = 2015; y <= 2019; y++) {
            for (let m = 1; m <= 12; m++) {
                if (y === 2019 && m > 1) break;
                const mm = String(m).padStart(2, '0');
                c *= m % 3 === 0 ? 0.97 : 1.02;
                pts.push(bar(`${y}-${mm}-01`, c));
            }
        }
        return pts;
    }
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
    const base = makeBase();
    const short = makeShort();
    // Constant-level VXN across every base date → all real (no proxy).
    const volVxn = base.map((b) => bar(b.date, 22));
    const volVix = base.map((b) => bar(b.date, 18));

    const cfg = {
        short,
        base,
        seed: 0,
        method: 'str' as const,
        shortLabel: 'JEPQ',
        volVxn,
        volVix,
        riskFreeRate: 0.03,
    };

    it('no longer throws; returns seam-continuous synthetic history', () => {
        const r = buildSyntheticHistory(cfg);
        expect(r.points.length).toBeGreaterThan(0);
        expect(r.realInception).toBe('2018-01-01');
        expect(r.points[r.points.length - 1]!.close).toBeCloseTo(
            short[0]!.close,
            8
        );
        expect(r.r2).toBeGreaterThanOrEqual(0);
        expect(r.r2).toBeLessThanOrEqual(1);
    });

    it('books premium as monthly dividends (≥ 0)', () => {
        const r = buildSyntheticHistory(cfg);
        const paying = r.points.filter((p) => p.dividends > 0);
        expect(paying.length).toBeGreaterThan(0);
        for (const p of r.points) expect(p.dividends).toBeGreaterThanOrEqual(0);
    });

    it('is deterministic (RNG 0 — bit-identical on repeat)', () => {
        expect(buildSyntheticHistory(cfg)).toEqual(buildSyntheticHistory(cfg));
    });
});
