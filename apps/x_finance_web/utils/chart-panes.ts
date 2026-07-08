// Purpose: Pure builders for RSI and MACD indicator panes in lightweight-charts.
// No React, no setState, no ref writes. Extracted from chart-series.ts to keep
// each file ≤300 LOC. Invariant: all mutations target the lightweight-charts
// IChartApi which is an external system boundary.

import {
    createSeriesMarkers,
    LineStyle,
    LineSeries,
    HistogramSeries,
    type IChartApi,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts';
import type { IOHLCPoint } from '@/types/history';
import type { ChartPalette } from '@/lib/chart-theme';
import type { MACDResult } from '@/types/dashboard';
import { computeRsiSignals } from '@/utils/computeRsiSignals';
import { computeMacdSignals } from '@/utils/computeMacdSignals';

interface LinePoint {
    time: Time;
    value: number;
}
interface HistPoint {
    time: Time;
    value: number;
    color: string;
}

const toTime = (t: string | number): Time => t as Time;

/** Adds RSI line + markers + overbought/oversold bands to paneIdx. */
export function buildRsiPane(
    chart: IChartApi,
    candles: IOHLCPoint[],
    palette: ChartPalette,
    rsiArr: (number | null)[],
    paneIdx: number
): void {
    const rsiSeries = chart.addSeries(
        LineSeries,
        {
            color: palette.rsi,
            lineWidth: 1,
            title: 'RSI(14)',
            lastValueVisible: true,
            priceLineVisible: false,
        },
        paneIdx
    );
    const rsiData: LinePoint[] = [];
    for (let i = 0; i < candles.length; i++) {
        const v = rsiArr[i];
        const c = candles[i];
        if (v !== null && v !== undefined && c !== undefined)
            rsiData.push({ time: toTime(c.time), value: v });
    }
    rsiSeries.setData(rsiData);

    const rsiMarkers: SeriesMarker<Time>[] = [];
    for (const sig of computeRsiSignals(rsiArr)) {
        const c = candles[sig.index];
        if (!c) continue;
        rsiMarkers.push({
            time: toTime(c.time),
            position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
            shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
            color: sig.type === 'buy' ? palette.candleUp : palette.candleDown,
            size: 0.6,
        });
    }
    if (rsiMarkers.length > 0) createSeriesMarkers(rsiSeries, rsiMarkers);

    const firstTime = candles[0]?.time;
    const lastTime = candles[candles.length - 1]?.time;
    if (firstTime !== undefined && lastTime !== undefined) {
        const overbought = chart.addSeries(
            LineSeries,
            {
                color: palette.rsiOverbought,
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                lastValueVisible: false,
                priceLineVisible: false,
            },
            paneIdx
        );
        overbought.setData([
            { time: toTime(firstTime), value: 70 },
            { time: toTime(lastTime), value: 70 },
        ]);
        const oversold = chart.addSeries(
            LineSeries,
            {
                color: palette.rsiOversold,
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                lastValueVisible: false,
                priceLineVisible: false,
            },
            paneIdx
        );
        oversold.setData([
            { time: toTime(firstTime), value: 30 },
            { time: toTime(lastTime), value: 30 },
        ]);
    }
}

/** Adds MACD line + signal + histogram + markers to paneIdx. */
export function buildMacdPane(
    chart: IChartApi,
    candles: IOHLCPoint[],
    palette: ChartPalette,
    macdResult: MACDResult,
    paneIdx: number
): void {
    const macdLine = chart.addSeries(
        LineSeries,
        {
            color: palette.macd,
            lineWidth: 1,
            title: 'MACD',
            lastValueVisible: true,
            priceLineVisible: false,
        },
        paneIdx
    );
    const macdData: LinePoint[] = [];
    for (let i = 0; i < candles.length; i++) {
        const v = macdResult.macd[i];
        const c = candles[i];
        if (v !== null && v !== undefined && c !== undefined)
            macdData.push({ time: toTime(c.time), value: v });
    }
    macdLine.setData(macdData);

    const signalLine = chart.addSeries(
        LineSeries,
        {
            color: palette.macdSignal,
            lineWidth: 1,
            title: 'Signal',
            lastValueVisible: true,
            priceLineVisible: false,
        },
        paneIdx
    );
    const signalData: LinePoint[] = [];
    for (let i = 0; i < candles.length; i++) {
        const v = macdResult.signal[i];
        const c = candles[i];
        if (v !== null && v !== undefined && c !== undefined)
            signalData.push({ time: toTime(c.time), value: v });
    }
    signalLine.setData(signalData);

    const histSeries = chart.addSeries(
        HistogramSeries,
        {
            priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
            title: 'Hist',
            lastValueVisible: false,
            priceLineVisible: false,
        },
        paneIdx
    );
    const histData: HistPoint[] = [];
    for (let i = 0; i < candles.length; i++) {
        const v = macdResult.histogram[i];
        const c = candles[i];
        if (v !== null && v !== undefined && c !== undefined) {
            histData.push({
                time: toTime(c.time),
                value: v,
                color: v >= 0 ? palette.macdHistUp : palette.macdHistDown,
            });
        }
    }
    histSeries.setData(histData);

    const macdMarkers: SeriesMarker<Time>[] = [];
    for (const sig of computeMacdSignals(macdResult.macd, macdResult.signal)) {
        const c = candles[sig.index];
        if (!c) continue;
        macdMarkers.push({
            time: toTime(c.time),
            position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
            shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
            color: sig.type === 'buy' ? palette.candleUp : palette.candleDown,
            size: 0.6,
        });
    }
    if (macdMarkers.length > 0) createSeriesMarkers(macdLine, macdMarkers);
}
