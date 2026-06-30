// utils/cusipColor.test.ts
// Purpose: regression-lock the cusipColor output for a fixed CUSIP set.
//   Any change to the hash or color formula must break these tests,
//   forcing a deliberate version bump (not an accidental drift).

import { describe, it, expect } from 'vitest';
import { cusipColor, cusipTextColor } from '@/utils/cusipColor';

// Pinned outputs — do NOT update without a deliberate decision.
// These values lock color stability across deployments.
describe('cusipColor — stability regression lock', () => {
    it('Apple Inc. (037833100) is stable', () => {
        expect(cusipColor('037833100')).toBe('hsl(144, 55%, 48%)');
    });

    it('Bank of America (084670702) is stable', () => {
        expect(cusipColor('084670702')).toBe('hsl(269, 55%, 48%)');
    });

    it('NVIDIA (67066G104) is stable', () => {
        expect(cusipColor('67066G104')).toBe('hsl(102, 55%, 48%)');
    });

    it('Microsoft (594918104) is stable', () => {
        expect(cusipColor('594918104')).toBe('hsl(328, 55%, 48%)');
    });

    it('Chevron (808513105) is stable', () => {
        expect(cusipColor('808513105')).toBe('hsl(198, 55%, 48%)');
    });
});

describe('cusipColor — format', () => {
    it('returns a valid hsl() string', () => {
        const color = cusipColor('037833100');
        expect(color).toMatch(/^hsl\(\d+, 55%, 48%\)$/);
    });

    it('empty string does not throw', () => {
        expect(() => cusipColor('')).not.toThrow();
    });

    it('same cusip always returns same color', () => {
        const c1 = cusipColor('123456789');
        const c2 = cusipColor('123456789');
        expect(c1).toBe(c2);
    });

    it('different cusips may return different colors', () => {
        // Not guaranteed to differ (hash collision possible) but the set below
        // was hand-verified to produce distinct hues.
        expect(cusipColor('037833100')).not.toBe(cusipColor('594918104'));
    });
});

describe('cusipTextColor', () => {
    it('returns white for Apple (hue 144 — green, not warm yellow)', () => {
        expect(cusipTextColor('037833100')).toBe('white');
    });

    it('returns white for Bank of America (hue 269 — purple)', () => {
        expect(cusipTextColor('084670702')).toBe('white');
    });
});
