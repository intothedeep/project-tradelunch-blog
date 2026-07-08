// utils/sparkline.test.ts
// Purpose: Contract tests for the SVG sparkline coordinate normalizer.
// Cases: empty, flat line, single point, normal range.

import { describe, it, expect } from 'vitest';
import { normalizeSpark } from '@/utils/sparkline';

const W = 200;
const H = 60;

describe('normalizeSpark', () => {
    it('empty input → empty output (no path)', () => {
        expect(normalizeSpark([], W, H)).toEqual([]);
    });

    it('flat line (min === max) → all points at mid-height', () => {
        const pts = normalizeSpark([100, 100, 100], W, H);
        expect(pts).toHaveLength(3);
        // Non-null safe: length checked above.

        pts.forEach((p) => expect(p!.y).toBe(H / 2));
    });

    it('single point → x at width/2, y at mid-height', () => {
        const pts = normalizeSpark([50], W, H);
        expect(pts).toHaveLength(1);

        expect(pts[0]!.x).toBe(W / 2);

        expect(pts[0]!.y).toBe(H / 2);
    });

    it('normal range: first x=0, last x=width; min close → y=height, max close → y=0', () => {
        const pts = normalizeSpark([0, 50, 100], W, H);

        expect(pts[0]!.x).toBe(0);

        expect(pts[2]!.x).toBe(W);
        // min close (0) → highest y (bottom of chart)

        expect(pts[0]!.y).toBeCloseTo(H);
        // max close (100) → y=0 (top of chart)

        expect(pts[2]!.y).toBeCloseTo(0);
    });

    it('mid value maps to mid-height for symmetric range', () => {
        const pts = normalizeSpark([0, 50, 100], W, H);
        // 50 is midpoint of [0,100] → y = H / 2

        expect(pts[1]!.y).toBeCloseTo(H / 2);
    });

    it('x coordinates are evenly spaced from 0 to width', () => {
        const pts = normalizeSpark([10, 20, 30, 40], W, H);

        expect(pts[0]!.x).toBeCloseTo(0);

        expect(pts[1]!.x).toBeCloseTo(W / 3);

        expect(pts[2]!.x).toBeCloseTo((2 * W) / 3);

        expect(pts[3]!.x).toBeCloseTo(W);
    });
});
