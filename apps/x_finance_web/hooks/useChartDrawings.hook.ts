'use client';

// Purpose: drives chart drawing UX. Reads/writes drawing atoms, subscribes
// to chart click + crosshair-move events, applies magnet snapping, and
// (re)attaches a single DrawingsPrimitive whenever the underlying chart
// rebuilds (interval/range/indicator changes).

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type {
    IChartApi,
    ISeriesApi,
    MouseEventParams,
    Time,
} from 'lightweight-charts';
import {
    activeDrawToolAtom,
    cursorPreviewAtom,
    drawingsAtom,
    drawingsKey,
    inProgressDrawingAtom,
    magnetModeAtom,
    selectedDrawingIdAtom,
} from '@/store/drawings.atom';
import type { Drawing, DrawingPoint } from '@/lib/drawings/types';
import { POINTS_REQUIRED } from '@/lib/drawings/types';
import { DrawingsPrimitive } from '@/lib/drawings/primitive';
import { hitTestDrawings } from '@/lib/drawings/hitTest';
import type { IOHLCPoint } from '@/types/history';

interface Params {
    chartRef: RefObject<IChartApi | null>;
    candleSeriesRef: RefObject<ISeriesApi<'Candlestick', Time> | null>;
    chartReady: number;
    candles: IOHLCPoint[];
    label: string | null;
    interval: string;
    enabled: boolean;
    haloColor: string;
}

const SNAP_PX = 12;

export function useChartDrawings({
    chartRef,
    candleSeriesRef,
    chartReady,
    candles,
    label,
    interval,
    enabled,
    haloColor,
}: Params): void {
    const activeTool = useAtomValue(activeDrawToolAtom);
    const setActiveTool = useSetAtom(activeDrawToolAtom);
    const [inProgress, setInProgress] = useAtom(inProgressDrawingAtom);
    const [cursor, setCursor] = useAtom(cursorPreviewAtom);
    const [selectedId, setSelectedId] = useAtom(selectedDrawingIdAtom);
    const magnet = useAtomValue(magnetModeAtom);
    const [drawingsByKey, setDrawingsByKey] = useAtom(drawingsAtom);
    const primitiveRef = useRef<DrawingsPrimitive | null>(null);

    const key = label !== null ? drawingsKey(label, interval) : null;
    // Memoize so the array identity is stable across renders; otherwise the
    // `?? []` fallback yields a fresh array each render and destabilizes the
    // effects below that depend on `drawings`.
    const drawings = useMemo(
        () => (key !== null ? (drawingsByKey[key] ?? []) : []),
        [key, drawingsByKey]
    );

    // Snap cursor coordinates to nearest OHLC of nearest bar based on magnet mode.
    const resolvePoint = useCallback(
        (param: MouseEventParams<Time>): DrawingPoint | null => {
            const chart = chartRef.current;
            const series = candleSeriesRef.current;
            if (!chart || !series) return null;
            const pt = param.point;
            if (!pt) return null;
            const logical = chart.timeScale().coordinateToLogical(pt.x);
            if (logical === null) return null;
            const idx = Math.round(logical);
            const candle = candles[idx];
            if (!candle) return null;
            const rawPrice = series.coordinateToPrice(pt.y);
            if (rawPrice === null) return null;

            if (magnet === 'off') {
                return { time: candle.time, price: rawPrice as number };
            }
            const candidates =
                magnet === 'strong'
                    ? [candle.high, candle.low]
                    : [candle.open, candle.high, candle.low, candle.close];
            let bestPrice = candidates[0] as number;
            let bestDist = Infinity;
            for (const p of candidates) {
                const py = series.priceToCoordinate(p);
                if (py === null) continue;
                const dist = Math.abs((py as number) - pt.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestPrice = p;
                }
            }
            if (magnet === 'loose' && bestDist > SNAP_PX) {
                return { time: candle.time, price: rawPrice as number };
            }
            return { time: candle.time, price: bestPrice };
        },
        [chartRef, candleSeriesRef, candles, magnet]
    );

    // Mouse-driven state machine.
    useEffect(() => {
        if (!enabled || !chartReady) return;
        const chart = chartRef.current;
        if (!chart) return;

        const onMove = (param: MouseEventParams<Time>) => {
            const p = resolvePoint(param);
            setCursor(p);
        };
        const onClick = (param: MouseEventParams<Time>) => {
            const point = resolvePoint(param);
            if (activeTool === null) {
                const series = candleSeriesRef.current;
                const pt = param.point;
                if (!chart || !series || !pt) return;
                const id = hitTestDrawings(drawings, pt.x, pt.y, chart, series);
                setSelectedId(id);
                return;
            }
            if (!point || key === null) return;
            const required = POINTS_REQUIRED[activeTool];
            const next = inProgress
                ? { kind: activeTool, points: [...inProgress.points, point] }
                : { kind: activeTool, points: [point] };
            if (next.points.length >= required) {
                const drawing = buildDrawing(activeTool, next.points);
                if (drawing !== null) {
                    setDrawingsByKey((prev) => ({
                        ...prev,
                        [key]: [...(prev[key] ?? []), drawing],
                    }));
                }
                setInProgress(null);
            } else {
                setInProgress(next);
            }
        };

        chart.subscribeCrosshairMove(onMove);
        chart.subscribeClick(onClick);
        return () => {
            try {
                chart.unsubscribeCrosshairMove(onMove);
            } catch {
                /* chart disposed */
            }
            try {
                chart.unsubscribeClick(onClick);
            } catch {
                /* chart disposed */
            }
        };
    }, [
        enabled,
        chartReady,
        chartRef,
        candleSeriesRef,
        activeTool,
        inProgress,
        drawings,
        key,
        resolvePoint,
        setCursor,
        setSelectedId,
        setInProgress,
        setDrawingsByKey,
    ]);

    // Keyboard shortcuts: Escape cancels in-progress, Delete removes selected.
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setInProgress(null);
                setActiveTool(null);
                setSelectedId(null);
            } else if (
                (e.key === 'Delete' || e.key === 'Backspace') &&
                selectedId !== null &&
                key !== null
            ) {
                setDrawingsByKey((prev) => ({
                    ...prev,
                    [key]: (prev[key] ?? []).filter((d) => d.id !== selectedId),
                }));
                setSelectedId(null);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [
        enabled,
        selectedId,
        key,
        setInProgress,
        setActiveTool,
        setSelectedId,
        setDrawingsByKey,
    ]);

    // (Re)attach the primitive whenever the chart instance is rebuilt.
    useEffect(() => {
        if (!enabled || !chartReady) return;
        const series = candleSeriesRef.current;
        if (!series) return;
        const primitive = new DrawingsPrimitive({
            drawings,
            selectedId,
            inProgress,
            cursor,
            selectionHaloColor: haloColor,
        });
        primitiveRef.current = primitive;
        series.attachPrimitive(primitive);
        return () => {
            try {
                series.detachPrimitive(primitive);
            } catch {
                /* chart already removed */
            }
            primitiveRef.current = null;
        };
    }, [enabled, chartReady, candleSeriesRef, haloColor]); // eslint-disable-line react-hooks/exhaustive-deps

    // Push input updates without rebuilding the primitive.
    useEffect(() => {
        primitiveRef.current?.setInput({
            drawings,
            selectedId,
            inProgress,
            cursor,
            selectionHaloColor: haloColor,
        });
    }, [drawings, selectedId, inProgress, cursor, haloColor]);
}

function buildDrawing(
    kind: Drawing['kind'],
    points: DrawingPoint[]
): Drawing | null {
    const id = crypto.randomUUID();
    const color = '#2962ff';
    const lineWidth = 1;
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];
    switch (kind) {
        case 'horizontal_line':
            return p1 ? { id, kind, color, lineWidth, price: p1.price } : null;
        case 'vertical_line':
            return p1 ? { id, kind, color, lineWidth, time: p1.time } : null;
        case 'trend_line':
            return p1 && p2 ? { id, kind, color, lineWidth, p1, p2 } : null;
        case 'ray':
            return p1 && p2 ? { id, kind, color, lineWidth, p1, p2 } : null;
        case 'parallel_channel':
            return p1 && p2 && p3
                ? {
                      id,
                      kind,
                      color,
                      lineWidth,
                      p1,
                      p2,
                      p3,
                      fillColor: 'rgba(41,98,255,0.12)',
                  }
                : null;
        case 'fib_retracement':
            return p1 && p2 ? { id, kind, color, lineWidth, p1, p2 } : null;
        case 'fib_extension':
            return p1 && p2 && p3
                ? { id, kind, color, lineWidth, p1, p2, p3 }
                : null;
    }
}
