'use client';

// Purpose: Orchestrates a lightweight-charts v5 instance for the dashboard
// chart panel. Delegates pure series/setup work to utils/chart-series and
// utils/chart-setup; keeps all React state/ref management and the effect
// teardown closure here.

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { IOHLCPoint } from '@/types/history';
import type { ChartPalette } from '@/lib/chart-theme';
import type { ChartRange } from '@/store/dashboard.atom';
import type { IndicatorState } from '@/types/dashboard';
import {
    createTvChart,
    applyPaneStretch,
    applyVisibleRange,
} from '@/utils/chart-setup';
import {
    buildCandleAndVolumeSeries,
    buildMaSeries,
    buildIchimoku,
} from '@/utils/chart-series';
import { buildRsiPane, buildMacdPane } from '@/utils/chart-panes';

interface Params {
    containerRef: RefObject<HTMLDivElement | null>;
    candles: IOHLCPoint[];
    indicators: IndicatorState;
    palette: ChartPalette;
    selectedRange: ChartRange;
    enabled: boolean;
}

export interface PaneRect {
    top: number;
    height: number;
}
export interface IndicatorPaneRects {
    rsi: PaneRect | null;
    macd: PaneRect | null;
}

export interface ChartHandles {
    hoverIndex: number | null;
    paneRects: IndicatorPaneRects;
    chartRef: RefObject<IChartApi | null>;
    candleSeriesRef: RefObject<ISeriesApi<'Candlestick', Time> | null>;
    chartReady: number;
}

export function useTradingViewChart({
    containerRef,
    candles,
    indicators,
    palette,
    selectedRange,
    enabled,
}: Params): ChartHandles {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [paneRects, setPaneRects] = useState<IndicatorPaneRects>({
        rsi: null,
        macd: null,
    });
    const [chartReady, setChartReady] = useState(0);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(
        null
    );

    const {
        maArrays,
        rsiArr,
        macdResult,
        ichimoku,
        maVisible,
        rsiVisible,
        macdVisible,
        ichimokuVisible,
    } = indicators;

    useEffect(() => {
        if (!enabled) return;
        const container = containerRef.current;
        if (!container) return;
        if (candles.length === 0) return;

        const chart = createTvChart(container, candles, palette);
        chartRef.current = chart;

        const candleSeries = buildCandleAndVolumeSeries(
            chart,
            candles,
            palette
        );
        candleSeriesRef.current = candleSeries;
        setChartReady((n) => n + 1);

        buildMaSeries(chart, candles, palette, maArrays, maVisible);

        if (ichimokuVisible) {
            buildIchimoku(chart, candleSeries, candles, palette, ichimoku);
        }

        let nextPaneIdx = 1;
        if (rsiVisible) {
            buildRsiPane(chart, candles, palette, rsiArr, nextPaneIdx++);
        }
        if (macdVisible) {
            buildMacdPane(chart, candles, palette, macdResult, nextPaneIdx++);
        }

        applyPaneStretch(chart);
        applyVisibleRange(chart, selectedRange, candles);

        let disposed = false;
        const measurePanes = () => {
            if (disposed) return;
            try {
                const containerRect = container.getBoundingClientRect();
                let paneIdx = 1;
                const rects: IndicatorPaneRects = { rsi: null, macd: null };
                const readPane = (i: number): PaneRect | null => {
                    const el = chart.panes()[i]?.getHTMLElement();
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { top: r.top - containerRect.top, height: r.height };
                };
                if (rsiVisible) {
                    rects.rsi = readPane(paneIdx++);
                }
                if (macdVisible) {
                    rects.macd = readPane(paneIdx++);
                }
                setPaneRects(rects);
            } catch {
                // chart disposed mid-frame; ignore
            }
        };
        requestAnimationFrame(measurePanes);

        chart.subscribeCrosshairMove((param) => {
            if (param.time === undefined) {
                setHoverIndex(null);
                return;
            }
            const idx = candles.findIndex((c) => c.time === param.time);
            setHoverIndex(idx >= 0 ? idx : null);
        });

        const observer = new ResizeObserver(() => {
            if (disposed) return;
            try {
                chart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight,
                });
                requestAnimationFrame(measurePanes);
            } catch {
                // chart disposed between resize fire and apply; ignore
            }
        });
        observer.observe(container);

        return () => {
            disposed = true;
            observer.disconnect();
            try {
                chart.remove();
            } catch {
                /* already disposed */
            }
            chartRef.current = null;
            candleSeriesRef.current = null;
            setHoverIndex(null);
            setPaneRects({ rsi: null, macd: null });
        };
    }, [
        enabled,
        containerRef,
        candles,
        maArrays,
        rsiArr,
        macdResult,
        ichimoku,
        palette,
        maVisible,
        rsiVisible,
        macdVisible,
        ichimokuVisible,
        selectedRange,
    ]);

    return { hoverIndex, paneRects, chartRef, candleSeriesRef, chartReady };
}
