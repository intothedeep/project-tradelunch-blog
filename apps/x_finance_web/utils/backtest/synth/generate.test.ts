// generate.test.ts — X2-P2.4
import { describe, expect, it } from 'vitest';
import { generatePreInception } from './generate';
import type { PricePoint } from '@/types/backtest';
import type { RegressionFit } from './types';

function bar(date: string, close: number): PricePoint {
    return { date, close, dividends: 0, stockSplits: 0 };
}

const fit: RegressionFit = {
    alphaUp: 0.0001,
    alphaDown: 0.0001,
    betaUp: 0.6,
    betaDown: 1.2,
    r2: 0.8,
    residuals: [0.001, -0.002, 0.0015, -0.001, 0.0005, -0.0008, 0.002, -0.0012],
};

// base has history 2019-06 .. 2020-01; short inception 2020-01-01.
const baseSeries: PricePoint[] = [
    bar('2019-06-01', 80),
    bar('2019-07-01', 82),
    bar('2019-08-01', 79),
    bar('2019-09-01', 85),
    bar('2019-10-01', 88),
    bar('2019-11-01', 86),
    bar('2019-12-01', 90),
    bar('2020-01-01', 92),
];

const input = {
    fit,
    baseSeries,
    realInception: '2020-01-01',
    realFirstClose: 50,
    seed: 7,
    shortLabel: 'JEPQ',
};

describe('generatePreInception', () => {
    it('same (seed,fit,base) ⇒ byte-identical output', () => {
        expect(generatePreInception(input)).toEqual(
            generatePreInception(input)
        );
    });

    it('different seed ⇒ different output', () => {
        const a = generatePreInception(input);
        const b = generatePreInception({ ...input, seed: 999 });
        expect(a).not.toEqual(b);
    });

    it('different label ⇒ different bootstrap (decorrelated seed)', () => {
        const a = generatePreInception(input);
        const b = generatePreInception({ ...input, shortLabel: 'SPYI' });
        expect(a).not.toEqual(b);
    });

    it('covers only base dates strictly before realInception, ascending', () => {
        const pts = generatePreInception(input);
        expect(pts.length).toBeGreaterThan(0);
        for (const p of pts) expect(p.date < '2020-01-01').toBe(true);
        const dates = pts.map((p) => p.date);
        expect([...dates].sort()).toEqual(dates);
    });

    it('seam continuity: last synthetic close equals realFirstClose', () => {
        const pts = generatePreInception(input);
        expect(pts[pts.length - 1]!.close).toBeCloseTo(50, 10);
    });

    it('all synthetic bars carry stockSplits=0 and dividends=0', () => {
        const pts = generatePreInception(input);
        for (const p of pts) {
            expect(p.stockSplits).toBe(0);
            expect(p.dividends).toBe(0);
        }
    });

    it('empty when base has no pre-inception history', () => {
        const pts = generatePreInception({
            ...input,
            baseSeries: [bar('2020-01-01', 92), bar('2020-02-01', 95)],
        });
        expect(pts).toEqual([]);
    });
});
