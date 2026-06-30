// Purpose: Pure derived-value computation for the chart panel header and
// crosshair display. No React, no side effects. Takes raw candles + hover
// index and returns all display values needed by the panel.

import type { IOHLCPoint } from '@/types/history';
import { formatCandleTime } from '@/utils/chart-format';

export interface ChartHeaderDerived {
    lastClose: number;
    change: number;
    changePercent: number;
    lastTimeLabel: string;
    displayIdx: number;
    displayCandle: IOHLCPoint | null;
}

/** Derives all header/hover display values from candles + hoverIndex. */
export function deriveChartHeader(
    candles: IOHLCPoint[],
    hoverIndex: number | null
): ChartHeaderDerived {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const lastClose = last?.close ?? 0;
    const prevClose = prev?.close ?? lastClose;
    const change = lastClose - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const lastTimeLabel = last !== undefined ? formatCandleTime(last.time) : '';

    const displayIdx = hoverIndex ?? candles.length - 1;
    const displayCandle = candles[displayIdx] ?? null;

    return {
        lastClose,
        change,
        changePercent,
        lastTimeLabel,
        displayIdx,
        displayCandle,
    };
}
