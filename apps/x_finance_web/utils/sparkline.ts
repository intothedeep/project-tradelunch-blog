// utils/sparkline.ts
// Purpose: Pure geometry helpers for SVG polyline sparklines.
// Invariants:
//   - Empty input → empty output (no division by zero).
//   - Flat line (min === max) → all points map to mid-height.
//   - Coordinate system: x left→right (ascending time), y top→bottom (higher close = lower y).
// Side effects: none.

export interface SparkPoint {
    x: number;
    y: number;
}

/**
 * Normalize a series of close prices to SVG polyline coordinates.
 * @param closes  Ordered close prices (ascending time).
 * @param width   SVG viewBox width.
 * @param height  SVG viewBox height.
 * @returns       Array of {x, y} coords, same length as closes.
 */
export function normalizeSpark(
    closes: number[],
    width: number,
    height: number
): SparkPoint[] {
    if (closes.length === 0) return [];
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min;
    const n = closes.length;
    return closes.map((c, i) => ({
        x: n === 1 ? width / 2 : (i / (n - 1)) * width,
        y: range === 0 ? height / 2 : height - ((c - min) / range) * height,
    }));
}
