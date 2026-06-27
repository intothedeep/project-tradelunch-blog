// Fibonacci retracement: between p1 and p2, draws horizontal lines at
// price = p2 + level*(p1-p2). Each level is rendered with a label showing
// the percentage and the price.

import type {
    IChartApi,
    ISeriesApi,
    SeriesType,
    Time,
} from 'lightweight-charts';
import type { FibRetracementDrawing } from '../types';
import { FIB_LEVELS } from '../types';
import { applyLineStyle, toPixel, type PaneBounds } from '../drawCoords';

const FIB_COLORS = [
    '#787b86', // 0
    '#ef5350', // 0.236
    '#ff9800', // 0.382
    '#ffd54f', // 0.5
    '#26a69a', // 0.618
    '#42a5f5', // 0.786
    '#ab47bc', // 1
];

export function drawFibRetracement(
    ctx: CanvasRenderingContext2D,
    d: FibRetracementDrawing,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    bounds: PaneBounds
): void {
    const a = toPixel(chart, series, d.p1);
    const b = toPixel(chart, series, d.p2);
    if (!a || !b) return;

    const xLeft = Math.min(a.x, b.x);
    const xRight = Math.max(a.x, b.x);
    const priceHigh = Math.max(d.p1.price, d.p2.price);
    const priceLow = Math.min(d.p1.price, d.p2.price);

    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < FIB_LEVELS.length; i++) {
        const lvl = FIB_LEVELS[i] as number;
        const price = priceLow + lvl * (priceHigh - priceLow);
        const y = series.priceToCoordinate(price);
        if (y === null) continue;
        const color = FIB_COLORS[i] ?? d.color;
        applyLineStyle(ctx, color, d.lineWidth);
        ctx.beginPath();
        ctx.moveTo(xLeft, y as number);
        ctx.lineTo(bounds.width, y as number);
        ctx.stroke();

        ctx.fillStyle = color;
        const label = `${(lvl * 100).toFixed(1)}% (${price.toFixed(2)})`;
        ctx.fillText(label, xRight + 4, y as number);
    }
}
