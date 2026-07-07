// overlap.test.ts — X2-P2.2
import { describe, expect, it } from 'vitest';
import { alignOverlap } from './overlap';
import type { PricePoint } from '@/types/backtest';

function bar(date: string, close: number, dividends = 0): PricePoint {
    return { date, close, dividends, stockSplits: 0 };
}

describe('alignOverlap', () => {
    it('intersects on common return bars (both have a predecessor)', () => {
        // base has 2020-01..05, short starts 2020-03.
        const base = [
            bar('2020-01-01', 100),
            bar('2020-02-01', 110),
            bar('2020-03-01', 121),
            bar('2020-04-01', 121),
            bar('2020-05-01', 133.1),
        ];
        const short = [
            bar('2020-03-01', 50),
            bar('2020-04-01', 50),
            bar('2020-05-01', 55),
        ];
        const r = alignOverlap(short, base);
        // short return defined on 04-01 and 05-01 (needs in-series predecessor);
        // base defined on both too. 03-01 excluded (short's first bar).
        expect(r.bars.map((b) => b.date)).toEqual(['2020-04-01', '2020-05-01']);
        expect(r.realInception).toBe('2020-03-01');
        // 04-01: rShort = 50/50-1 = 0, rBase = 121/121-1 = 0
        expect(r.bars[0]!.rShort).toBeCloseTo(0, 12);
        expect(r.bars[0]!.rBase).toBeCloseTo(0, 12);
        // 05-01: rShort = 55/50-1 = 0.1, rBase = 133.1/121-1 = 0.1
        expect(r.bars[1]!.rShort).toBeCloseTo(0.1, 12);
        expect(r.bars[1]!.rBase).toBeCloseTo(0.1, 12);
    });

    it('handles mismatched calendars / missing bars (only shared dates kept)', () => {
        const base = [
            bar('2020-01-01', 100),
            bar('2020-02-01', 110),
            bar('2020-03-01', 121),
            bar('2020-04-01', 130),
        ];
        // short is missing 2020-03-01 (a gap) → its 04-01 predecessor is 02-01.
        const short = [
            bar('2020-01-01', 10),
            bar('2020-02-01', 11),
            bar('2020-04-01', 13),
        ];
        const r = alignOverlap(short, base);
        // Shared return dates: 02-01 (both have preds), 04-01 (both have preds).
        // 03-01 not in short at all.
        expect(r.bars.map((b) => b.date)).toEqual(['2020-02-01', '2020-04-01']);
    });

    it('throws on empty overlap', () => {
        const base = [bar('2020-01-01', 100), bar('2020-02-01', 110)];
        const short = [bar('2021-01-01', 10), bar('2021-02-01', 11)];
        expect(() => alignOverlap(short, base)).toThrow(/empty overlap/);
    });

    it('throws on empty short series', () => {
        expect(() => alignOverlap([], [bar('2020-01-01', 100)])).toThrow(
            /empty/
        );
    });

    it('is deterministic', () => {
        const base = [
            bar('2020-01-01', 100),
            bar('2020-02-01', 110),
            bar('2020-03-01', 121),
        ];
        const short = [
            bar('2020-01-01', 10),
            bar('2020-02-01', 11),
            bar('2020-03-01', 12),
        ];
        expect(alignOverlap(short, base)).toEqual(alignOverlap(short, base));
    });

    it('computes a positive annual yield when short pays dividends', () => {
        // 13 monthly bars (~1yr overlap span) with flat close=100 and a ~1%
        // monthly per-share dividend → annualized yield ≈ 12%.
        const base: PricePoint[] = [];
        const short: PricePoint[] = [];
        for (let m = 1; m <= 12; m++) {
            const mm = String(m).padStart(2, '0');
            base.push(bar(`2020-${mm}-01`, 100));
            short.push(bar(`2020-${mm}-01`, 100, 1)); // $1 on $100 ≈ 1%/mo
        }
        const r = alignOverlap(short, base);
        expect(r.shortAnnualYield).toBeGreaterThan(0.09);
        expect(r.shortAnnualYield).toBeLessThan(0.15);
    });
});
