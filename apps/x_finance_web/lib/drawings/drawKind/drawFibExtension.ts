// Fibonacci extension: impulse leg p1->p2 defines the unit. Levels are
// projected from p3 in the direction of the impulse.

import type {
    IChartApi,
    ISeriesApi,
    SeriesType,
    Time,
} from 'lightweight-charts';
import type { FibExtensionDrawing } from '../types';
import { FIB_EXT_LEVELS } from '../types';
import { applyLineStyle, toPixel, type PaneBounds } from '../drawCoords';

const FIB_EXT_COLORS = [
    '#787b86', // 0
    '#26a69a', // 0.618
    '#ffd54f', // 1
    '#ff9800', // 1.618
    '#ef5350', // 2.618
];

export function drawFibExtension(
    ctx: CanvasRenderingContext2D,
    d: FibExtensionDrawing,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    bounds: PaneBounds
): void {
    const a = toPixel(chart, series, d.p1);
    const b = toPixel(chart, series, d.p2);
    const c = toPixel(chart, series, d.p3);
    if (!a || !b || !c) return;

    const impulse = d.p2.price - d.p1.price;
    const xLeft = Math.min(c.x, b.x);

    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < FIB_EXT_LEVELS.length; i++) {
        const lvl = FIB_EXT_LEVELS[i] as number;
        const price = d.p3.price + lvl * impulse;
        const y = series.priceToCoordinate(price);
        if (y === null) continue;
        const color = FIB_EXT_COLORS[i] ?? d.color;
        applyLineStyle(ctx, color, d.lineWidth);
        ctx.beginPath();
        ctx.moveTo(xLeft, y as number);
        ctx.lineTo(bounds.width, y as number);
        ctx.stroke();

        ctx.fillStyle = color;
        const label = `${lvl.toFixed(3)} (${price.toFixed(2)})`;
        ctx.fillText(label, bounds.width - 110, y as number);
    }

    // Draw the impulse leg lightly.
    applyLineStyle(ctx, d.color, 1);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
