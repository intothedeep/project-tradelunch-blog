// Purpose: Pure chart-level setup helpers — create/configure the IChartApi
// instance, apply pane stretch, and set the initial visible range. No React,
// no setState, no ref writes.

import { createChart, ColorType, type IChartApi } from 'lightweight-charts';
import type { IOHLCPoint } from '@/types/history';
import type { ChartPalette } from '@/lib/chart-theme';
import type { ChartRange } from '@/store/dashboard.atom';
import { visibleStartIdx } from '@/utils/chart-format';

/** Creates and configures a lightweight-charts IChartApi inside container. */
export function createTvChart(
    container: HTMLDivElement,
    candles: IOHLCPoint[],
    palette: ChartPalette
): IChartApi {
    return createChart(container, {
        layout: {
            background: { type: ColorType.Solid, color: palette.bg },
            textColor: palette.textPrimary,
        },
        grid: {
            vertLines: { color: palette.gridLine },
            horzLines: { color: palette.gridLine },
        },
        rightPriceScale: { borderVisible: false },
        leftPriceScale: { borderVisible: false },
        timeScale: {
            borderVisible: false,
            timeVisible: typeof candles[0]?.time === 'number',
            secondsVisible: false,
        },
        crosshair: {
            mode: 1,
            vertLine: {
                color: palette.textSecondary,
                labelBackgroundColor: palette.gridLine,
            },
            horzLine: {
                color: palette.textSecondary,
                labelBackgroundColor: palette.gridLine,
            },
        },
        width: container.clientWidth,
        height: container.clientHeight,
    });
}

/** Sets main pane stretch factor 4x vs 1x for each indicator pane. */
export function applyPaneStretch(chart: IChartApi): void {
    const panes = chart.panes();
    if (panes.length > 1) {
        panes[0]?.setStretchFactor(4);
        for (let i = 1; i < panes.length; i++) {
            panes[i]?.setStretchFactor(1);
        }
    }
}

/** Scrolls the time scale to show the range window. */
export function applyVisibleRange(
    chart: IChartApi,
    selectedRange: ChartRange,
    candles: IOHLCPoint[]
): void {
    const startIdx = visibleStartIdx(selectedRange, candles);
    chart.timeScale().setVisibleLogicalRange({
        from: startIdx,
        to: candles.length - 1,
    });
}
