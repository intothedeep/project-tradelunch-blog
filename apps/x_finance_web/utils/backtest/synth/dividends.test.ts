// dividends.test.ts — X2-P2.5
import { describe, expect, it } from 'vitest';
import { synthesizeDividends } from './dividends';
import type { PricePoint } from '@/types/backtest';

function bar(date: string, close: number): PricePoint {
    return { date, close, dividends: 0, stockSplits: 0 };
}

// ~12 months of daily-ish bars (one per month for cadence simplicity + a few
// intra-month bars to verify only the first bar of a month pays).
function makeSpan(): PricePoint[] {
    const pts: PricePoint[] = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0');
        pts.push(bar(`2019-${mm}-01`, 100));
        pts.push(bar(`2019-${mm}-15`, 100)); // intra-month, should NOT pay
    }
    return pts;
}

describe('synthesizeDividends', () => {
    it('pays only on the first bar of each calendar month', () => {
        const out = synthesizeDividends(makeSpan(), 0.12); // 12% annual → 1%/mo
        const paying = out.filter((p) => p.dividends > 0);
        expect(paying).toHaveLength(12);
        for (const p of paying) expect(p.date.endsWith('-01')).toBe(true);
        // monthly amount = close · (0.12/12) = 100·0.01 = 1
        expect(paying[0]!.dividends).toBeCloseTo(1, 10);
    });

    it('synthetic-span annualized yield ≈ realized (±tol)', () => {
        const span = makeSpan();
        const annual = 0.09;
        const out = synthesizeDividends(span, annual);
        const totalDiv = out.reduce((a, p) => a + p.dividends, 0);
        const meanClose = out.reduce((a, p) => a + p.close, 0) / out.length;
        // 12 monthly payments over ~1 year → totalDiv / meanClose ≈ annual.
        expect(totalDiv / meanClose).toBeCloseTo(annual, 3);
    });

    it('all dividends ≥ 0; zero yield ⇒ no dividends', () => {
        const out = synthesizeDividends(makeSpan(), 0);
        for (const p of out) expect(p.dividends).toBe(0);
        const neg = synthesizeDividends(makeSpan(), -0.05);
        for (const p of neg) expect(p.dividends).toBe(0);
    });

    it('does not mutate the input and is deterministic', () => {
        const span = makeSpan();
        const snapshot = JSON.parse(JSON.stringify(span));
        const a = synthesizeDividends(span, 0.1);
        const b = synthesizeDividends(span, 0.1);
        expect(a).toEqual(b);
        expect(span).toEqual(snapshot); // untouched
    });

    it('handles empty input', () => {
        expect(synthesizeDividends([], 0.1)).toEqual([]);
    });
});
