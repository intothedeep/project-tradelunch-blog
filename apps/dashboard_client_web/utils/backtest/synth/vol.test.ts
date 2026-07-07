// vol.test.ts — X2-P2b.4 implied-vol resolution (VXN primary, k·VIX proxy)
import { describe, expect, it } from 'vitest';
import { resolveVol } from './vol';
import type { PricePoint } from '@/types/backtest';

function idx(date: string, level: number): PricePoint {
    return { date, close: level, dividends: 0, stockSplits: 0 };
}

// VXN exists 2001-01+; VIX exists 1999-01+. Overlap = the 2001 dates.
const vxn: PricePoint[] = [idx('2001-01-01', 30), idx('2001-02-01', 24)];
const vix: PricePoint[] = [
    idx('1999-01-01', 20),
    idx('2000-01-01', 25),
    idx('2001-01-01', 20), // ratio 30/20 = 1.5
    idx('2001-02-01', 16), // ratio 24/16 = 1.5
];
// k = mean(VXN/VIX over overlap) = mean(1.5, 1.5) = 1.5.

describe('resolveVol', () => {
    it('post-VXN dates use VXN/100 (isProxy=false)', () => {
        const m = resolveVol(['2001-01-01', '2001-02-01'], vxn, vix);
        expect(m.get('2001-01-01')).toEqual({ sigma: 0.3, isProxy: false });
        expect(m.get('2001-02-01')).toEqual({ sigma: 0.24, isProxy: false });
    });

    it('pre-VXN dates use k·VIX/100 with isProxy=true; k from overlap', () => {
        const m = resolveVol(['1999-01-01', '2000-01-01'], vxn, vix);
        // k = 1.5 → 1.5·20/100 = 0.30 ; 1.5·25/100 = 0.375.
        expect(m.get('1999-01-01')!.sigma).toBeCloseTo(0.3, 12);
        expect(m.get('1999-01-01')!.isProxy).toBe(true);
        expect(m.get('2000-01-01')!.sigma).toBeCloseTo(0.375, 12);
        expect(m.get('2000-01-01')!.isProxy).toBe(true);
    });

    it('throws when a date has neither VXN nor VIX', () => {
        expect(() => resolveVol(['1990-01-01'], vxn, vix)).toThrow(/no VXN/);
    });

    it('is deterministic (same input ⇒ identical output)', () => {
        const dates = ['1999-01-01', '2001-01-01'];
        expect([...resolveVol(dates, vxn, vix)]).toEqual([
            ...resolveVol(dates, vxn, vix),
        ]);
    });
});
