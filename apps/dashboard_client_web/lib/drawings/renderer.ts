// Purpose: Single canvas pass that draws every drawing + the in-progress
// preview. Dispatches per drawing kind. Selection halo is drawn after the
// drawing itself when its id matches selectedId.

import type {
    IChartApi,
    ISeriesApi,
    SeriesType,
    Time,
} from 'lightweight-charts';
import type { Drawing, DrawingKind, DrawingPoint } from './types';
import { drawHorizontalLine } from './drawKind/drawHorizontalLine';
import { drawVerticalLine } from './drawKind/drawVerticalLine';
import { drawTrendLine } from './drawKind/drawTrendLine';
import { drawRay } from './drawKind/drawRay';
import { drawParallelChannel } from './drawKind/drawParallelChannel';
import { drawFibRetracement } from './drawKind/drawFibRetracement';
import { drawFibExtension } from './drawKind/drawFibExtension';
import { applyLineStyle, toPixel, type PaneBounds } from './drawCoords';

export interface RenderInput {
    drawings: Drawing[];
    selectedId: string | null;
    inProgress: { kind: DrawingKind; points: DrawingPoint[] } | null;
    cursor: DrawingPoint | null;
    selectionHaloColor: string;
}

export function renderDrawings(
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    bounds: PaneBounds,
    input: RenderInput
): void {
    for (const d of input.drawings) {
        drawOne(ctx, d, chart, series, bounds);
        if (d.id === input.selectedId)
            drawSelectionHalo(ctx, d, chart, series, input.selectionHaloColor);
    }

    if (input.inProgress && input.cursor) {
        drawPreview(ctx, input.inProgress, input.cursor, chart, series, bounds);
    }
}

function drawOne(
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    bounds: PaneBounds
): void {
    switch (d.kind) {
        case 'horizontal_line':
            return drawHorizontalLine(ctx, d, series, bounds);
        case 'vertical_line':
            return drawVerticalLine(ctx, d, chart, bounds);
        case 'trend_line':
            return drawTrendLine(ctx, d, chart, series);
        case 'ray':
            return drawRay(ctx, d, chart, series, bounds);
        case 'parallel_channel':
            return drawParallelChannel(ctx, d, chart, series);
        case 'fib_retracement':
            return drawFibRetracement(ctx, d, chart, series, bounds);
        case 'fib_extension':
            return drawFibExtension(ctx, d, chart, series, bounds);
    }
}

function drawSelectionHalo(
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    color: string
): void {
    const points = anchorPoints(d);
    applyLineStyle(ctx, color, 1);
    for (const p of points) {
        const px = toPixel(chart, series, p);
        if (!px) continue;
        ctx.beginPath();
        ctx.arc(px.x, px.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function anchorPoints(d: Drawing): DrawingPoint[] {
    switch (d.kind) {
        case 'horizontal_line':
            return [];
        case 'vertical_line':
            return [];
        case 'trend_line':
            return [d.p1, d.p2];
        case 'ray':
            return [d.p1, d.p2];
        case 'parallel_channel':
            return [d.p1, d.p2, d.p3];
        case 'fib_retracement':
            return [d.p1, d.p2];
        case 'fib_extension':
            return [d.p1, d.p2, d.p3];
    }
}

function drawPreview(
    ctx: CanvasRenderingContext2D,
    inProgress: { kind: DrawingKind; points: DrawingPoint[] },
    cursor: DrawingPoint,
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    bounds: PaneBounds
): void {
    const PREVIEW_COLOR = '#2962ff';
    const ghost: Drawing | null = buildGhost(inProgress, cursor, PREVIEW_COLOR);
    if (!ghost) return;
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawOne(ctx, ghost, chart, series, bounds);
    ctx.restore();
}

function buildGhost(
    ip: { kind: DrawingKind; points: DrawingPoint[] },
    cursor: DrawingPoint,
    color: string
): Drawing | null {
    const id = '__preview__';
    const lineWidth = 1;
    switch (ip.kind) {
        case 'horizontal_line':
            return {
                id,
                kind: 'horizontal_line',
                color,
                lineWidth,
                price: cursor.price,
            };
        case 'vertical_line':
            return {
                id,
                kind: 'vertical_line',
                color,
                lineWidth,
                time: cursor.time,
            };
        case 'trend_line': {
            const p1 = ip.points[0];
            if (!p1) return null;
            return { id, kind: 'trend_line', color, lineWidth, p1, p2: cursor };
        }
        case 'ray': {
            const p1 = ip.points[0];
            if (!p1) return null;
            return { id, kind: 'ray', color, lineWidth, p1, p2: cursor };
        }
        case 'parallel_channel': {
            const p1 = ip.points[0];
            const p2 = ip.points[1];
            if (!p1) return null;
            if (!p2) {
                return {
                    id,
                    kind: 'trend_line',
                    color,
                    lineWidth,
                    p1,
                    p2: cursor,
                };
            }
            return {
                id,
                kind: 'parallel_channel',
                color,
                lineWidth,
                fillColor: 'rgba(41,98,255,0.12)',
                p1,
                p2,
                p3: cursor,
            };
        }
        case 'fib_retracement': {
            const p1 = ip.points[0];
            if (!p1) return null;
            return {
                id,
                kind: 'fib_retracement',
                color,
                lineWidth,
                p1,
                p2: cursor,
            };
        }
        case 'fib_extension': {
            const p1 = ip.points[0];
            const p2 = ip.points[1];
            if (!p1) return null;
            if (!p2) {
                return {
                    id,
                    kind: 'trend_line',
                    color,
                    lineWidth,
                    p1,
                    p2: cursor,
                };
            }
            return {
                id,
                kind: 'fib_extension',
                color,
                lineWidth,
                p1,
                p2,
                p3: cursor,
            };
        }
    }
}
