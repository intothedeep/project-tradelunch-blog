// Purpose: Pure builders for lightweight-charts series. No React, no setState,
// no ref writes. Each builder receives a chart instance and returns the created
// series so the orchestrating hook can store it in a ref if needed.
// Invariant: builders are side-effect-free on React state; all mutations are to
// the lightweight-charts IChartApi which is an external system boundary.
// RSI/MACD pane builders live in utils/chart-panes.ts (kept ≤300 LOC each).

import {
    CandlestickSeries,
    LineSeries,
    HistogramSeries,
    type IChartApi,
    type ISeriesApi,
    type Time,
} from 'lightweight-charts';
import type { IOHLCPoint } from '@/types/history';
import type { ChartPalette } from '@/lib/chart-theme';
import type {
    MAVisibility,
    MAArrays,
    MAPeriod,
    IchimokuResult,
} from '@/types/dashboard';
import { MA_PERIODS } from '@/types/dashboard';
import {
    IchimokuCloudPrimitive,
    type CloudPoint,
} from '@/lib/ichimokuCloud.plugin';

interface LinePoint {
    time: Time;
    value: number;
}

const toTime = (t: string | number): Time => t as Time;

/** Adds candle + volume series to chart. Returns the candlestick ISeriesApi. */
export function buildCandleAndVolumeSeries(
    chart: IChartApi,
    candles: IOHLCPoint[],
    palette: ChartPalette
): ISeriesApi<'Candlestick', Time> {
    const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: palette.candleUp,
        downColor: palette.candleDown,
        borderVisible: false,
        wickUpColor: palette.candleUp,
        wickDownColor: palette.candleDown,
        lastValueVisible: true,
        priceLineVisible: true,
    });
    candleSeries.setData(
        candles.map((c) => ({
            time: toTime(c.time),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.7, bottom: 0 },
    });
    volumeSeries.setData(
        candles.map((c) => ({
            time: toTime(c.time),
            value: c.volume,
            color: c.close >= c.open ? palette.volumeUp : palette.volumeDown,
        }))
    );

    return candleSeries;
}

/** Adds MA line series to chart for all visible periods. */
export function buildMaSeries(
    chart: IChartApi,
    candles: IOHLCPoint[],
    palette: ChartPalette,
    maArrays: MAArrays,
    maVisible: MAVisibility
): void {
    const maColors: Record<MAPeriod, string> = {
        5: palette.ma5,
        20: palette.ma20,
        50: palette.ma50,
        100: palette.ma100,
        200: palette.ma200,
    };
    for (const period of MA_PERIODS) {
        if (!maVisible[period]) continue;
        const maSeries = chart.addSeries(LineSeries, {
            color: maColors[period],
            lineWidth: 1,
            title: `MA${period}`,
            lastValueVisible: true,
            priceLineVisible: false,
        });
        const data: LinePoint[] = [];
        for (let i = 0; i < candles.length; i++) {
            const v = maArrays[period][i];
            const c = candles[i];
            if (v !== null && v !== undefined && c !== undefined)
                data.push({ time: toTime(c.time), value: v });
        }
        maSeries.setData(data);
    }
}

/** Adds Ichimoku lines + cloud primitive to chart. */
export function buildIchimoku(
    chart: IChartApi,
    candleSeries: ISeriesApi<'Candlestick', Time>,
    candles: IOHLCPoint[],
    palette: ChartPalette,
    ichimoku: IchimokuResult
): void {
    const lines: Array<{
        key: keyof typeof ichimoku;
        color: string;
        title: string;
    }> = [
        { key: 'tenkan', color: palette.ichimokuTenkan, title: 'Tenkan' },
        { key: 'kijun', color: palette.ichimokuKijun, title: 'Kijun' },
        { key: 'senkouA', color: palette.ichimokuSpanA, title: 'Span A' },
        { key: 'senkouB', color: palette.ichimokuSpanB, title: 'Span B' },
        { key: 'chikou', color: palette.ichimokuChikou, title: 'Chikou' },
    ];
    for (const { key, color, title } of lines) {
        const series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            title,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        const arr = ichimoku[key];
        const data: LinePoint[] = [];
        for (let i = 0; i < candles.length; i++) {
            const v = arr[i];
            const c = candles[i];
            if (v !== null && v !== undefined && c !== undefined)
                data.push({ time: toTime(c.time), value: v });
        }
        series.setData(data);
    }

    const cloudPoints: CloudPoint[] = candles.map((c, i) => ({
        time: toTime(c.time),
        spanA: ichimoku.senkouA[i] ?? null,
        spanB: ichimoku.senkouB[i] ?? null,
    }));
    const cloud = new IchimokuCloudPrimitive(
        cloudPoints,
        palette.ichimokuCloudUp,
        palette.ichimokuCloudDown
    );
    candleSeries.attachPrimitive(cloud);
}
