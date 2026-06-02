'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { IOHLCPoint } from '@/types/history'
import type { ChartPalette } from '@/lib/chart-theme'
import type { ChartRange } from '@/store/dashboard.atom'
import { visibleStartIdx } from '@/utils/chart-format'
import { MA_PERIODS } from '@/types/dashboard'
import type { MAPeriod, IndicatorState } from '@/types/dashboard'
import { IchimokuCloudPrimitive, type CloudPoint } from '@/lib/ichimokuCloud.plugin'
import { computeRsiSignals } from '@/utils/computeRsiSignals'
import { computeMacdSignals } from '@/utils/computeMacdSignals'

interface Params {
  containerRef: RefObject<HTMLDivElement | null>
  candles: IOHLCPoint[]
  indicators: IndicatorState
  palette: ChartPalette
  selectedRange: ChartRange
  enabled: boolean
}

interface LinePoint { time: Time; value: number }
interface HistPoint { time: Time; value: number; color: string }

const toTime = (t: string | number): Time => t as Time

export interface PaneRect { top: number; height: number }
export interface IndicatorPaneRects { rsi: PaneRect | null; macd: PaneRect | null }

export interface ChartHandles {
  hoverIndex: number | null
  paneRects: IndicatorPaneRects
  chartRef: RefObject<IChartApi | null>
  candleSeriesRef: RefObject<ISeriesApi<'Candlestick', Time> | null>
  chartReady: number
}

export function useTradingViewChart({
  containerRef, candles, indicators, palette, selectedRange, enabled,
}: Params): ChartHandles {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [paneRects, setPaneRects] = useState<IndicatorPaneRects>({ rsi: null, macd: null })
  const [chartReady, setChartReady] = useState(0)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null)

  const {
    maArrays, rsiArr, macdResult, ichimoku,
    maVisible, rsiVisible, macdVisible, ichimokuVisible,
  } = indicators

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return
    if (candles.length === 0) return

    const chart = createChart(container, {
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
        vertLine: { color: palette.textSecondary, labelBackgroundColor: palette.gridLine },
        horzLine: { color: palette.textSecondary, labelBackgroundColor: palette.gridLine },
      },
      width: container.clientWidth,
      height: container.clientHeight,
    })

    chartRef.current = chart
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.candleUp,
      downColor: palette.candleDown,
      borderVisible: false,
      wickUpColor: palette.candleUp,
      wickDownColor: palette.candleDown,
      lastValueVisible: true,
      priceLineVisible: true,
    })
    candleSeriesRef.current = candleSeries
    candleSeries.setData(
      candles.map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))
    )
    setChartReady((n) => n + 1)

    const maColors: Record<MAPeriod, string> = {
      5: palette.ma5, 20: palette.ma20, 50: palette.ma50, 100: palette.ma100, 200: palette.ma200,
    }
    for (const period of MA_PERIODS) {
      if (!maVisible[period]) continue
      const maSeries = chart.addSeries(LineSeries, {
        color: maColors[period],
        lineWidth: 1,
        title: `MA${period}`,
        lastValueVisible: true,
        priceLineVisible: false,
      })
      const data: LinePoint[] = []
      for (let i = 0; i < candles.length; i++) {
        const v = maArrays[period][i]
        const c = candles[i]
        if (v !== null && v !== undefined && c !== undefined) data.push({ time: toTime(c.time), value: v })
      }
      maSeries.setData(data)
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
    })
    volumeSeries.setData(
      candles.map((c) => ({
        time: toTime(c.time),
        value: c.volume,
        color: c.close >= c.open ? palette.volumeUp : palette.volumeDown,
      }))
    )

    if (ichimokuVisible) {
      const lines: Array<{ key: keyof typeof ichimoku; color: string; title: string }> = [
        { key: 'tenkan',  color: palette.ichimokuTenkan, title: 'Tenkan' },
        { key: 'kijun',   color: palette.ichimokuKijun,  title: 'Kijun' },
        { key: 'senkouA', color: palette.ichimokuSpanA,  title: 'Span A' },
        { key: 'senkouB', color: palette.ichimokuSpanB,  title: 'Span B' },
        { key: 'chikou',  color: palette.ichimokuChikou, title: 'Chikou' },
      ]
      for (const { key, color, title } of lines) {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          title,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const arr = ichimoku[key]
        const data: LinePoint[] = []
        for (let i = 0; i < candles.length; i++) {
          const v = arr[i]
          const c = candles[i]
          if (v !== null && v !== undefined && c !== undefined) data.push({ time: toTime(c.time), value: v })
        }
        series.setData(data)
      }

      const cloudPoints: CloudPoint[] = candles.map((c, i) => ({
        time: toTime(c.time),
        spanA: ichimoku.senkouA[i] ?? null,
        spanB: ichimoku.senkouB[i] ?? null,
      }))
      const cloud = new IchimokuCloudPrimitive(
        cloudPoints,
        palette.ichimokuCloudUp,
        palette.ichimokuCloudDown,
      )
      candleSeries.attachPrimitive(cloud)
    }

    let nextPaneIdx = 1
    if (rsiVisible) {
      const rsiPaneIdx = nextPaneIdx++
      const rsiSeries = chart.addSeries(LineSeries, {
        color: palette.rsi,
        lineWidth: 1,
        title: 'RSI(14)',
        lastValueVisible: true,
        priceLineVisible: false,
      }, rsiPaneIdx)
      const rsiData: LinePoint[] = []
      for (let i = 0; i < candles.length; i++) {
        const v = rsiArr[i]
        const c = candles[i]
        if (v !== null && v !== undefined && c !== undefined) rsiData.push({ time: toTime(c.time), value: v })
      }
      rsiSeries.setData(rsiData)

      const rsiMarkers: SeriesMarker<Time>[] = []
      for (const sig of computeRsiSignals(rsiArr)) {
        const c = candles[sig.index]
        if (!c) continue
        rsiMarkers.push({
          time: toTime(c.time),
          position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
          shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
          color: sig.type === 'buy' ? palette.candleUp : palette.candleDown,
          size: 0.6,
        })
      }
      if (rsiMarkers.length > 0) createSeriesMarkers(rsiSeries, rsiMarkers)

      const firstTime = candles[0]?.time
      const lastTime = candles[candles.length - 1]?.time
      if (firstTime !== undefined && lastTime !== undefined) {
        const overbought = chart.addSeries(LineSeries, {
          color: palette.rsiOverbought, lineWidth: 1, lineStyle: LineStyle.Dashed,
          lastValueVisible: false, priceLineVisible: false,
        }, rsiPaneIdx)
        overbought.setData([{ time: toTime(firstTime), value: 70 }, { time: toTime(lastTime), value: 70 }])
        const oversold = chart.addSeries(LineSeries, {
          color: palette.rsiOversold, lineWidth: 1, lineStyle: LineStyle.Dashed,
          lastValueVisible: false, priceLineVisible: false,
        }, rsiPaneIdx)
        oversold.setData([{ time: toTime(firstTime), value: 30 }, { time: toTime(lastTime), value: 30 }])
      }
    }

    if (macdVisible) {
      const macdPaneIdx = nextPaneIdx++
      const macdLine = chart.addSeries(LineSeries, {
        color: palette.macd, lineWidth: 1, title: 'MACD',
        lastValueVisible: true, priceLineVisible: false,
      }, macdPaneIdx)
      const macdData: LinePoint[] = []
      for (let i = 0; i < candles.length; i++) {
        const v = macdResult.macd[i]
        const c = candles[i]
        if (v !== null && v !== undefined && c !== undefined) macdData.push({ time: toTime(c.time), value: v })
      }
      macdLine.setData(macdData)

      const signalLine = chart.addSeries(LineSeries, {
        color: palette.macdSignal, lineWidth: 1, title: 'Signal',
        lastValueVisible: true, priceLineVisible: false,
      }, macdPaneIdx)
      const signalData: LinePoint[] = []
      for (let i = 0; i < candles.length; i++) {
        const v = macdResult.signal[i]
        const c = candles[i]
        if (v !== null && v !== undefined && c !== undefined) signalData.push({ time: toTime(c.time), value: v })
      }
      signalLine.setData(signalData)

      const histSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        title: 'Hist', lastValueVisible: false, priceLineVisible: false,
      }, macdPaneIdx)
      const histData: HistPoint[] = []
      for (let i = 0; i < candles.length; i++) {
        const v = macdResult.histogram[i]
        const c = candles[i]
        if (v !== null && v !== undefined && c !== undefined) {
          histData.push({ time: toTime(c.time), value: v, color: v >= 0 ? palette.macdHistUp : palette.macdHistDown })
        }
      }
      histSeries.setData(histData)

      const macdMarkers: SeriesMarker<Time>[] = []
      for (const sig of computeMacdSignals(macdResult.macd, macdResult.signal)) {
        const c = candles[sig.index]
        if (!c) continue
        macdMarkers.push({
          time: toTime(c.time),
          position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
          shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
          color: sig.type === 'buy' ? palette.candleUp : palette.candleDown,
          size: 0.6,
        })
      }
      if (macdMarkers.length > 0) createSeriesMarkers(macdLine, macdMarkers)
    }

    const panes = chart.panes()
    if (panes.length > 1) {
      panes[0]?.setStretchFactor(4)
      for (let i = 1; i < panes.length; i++) {
        panes[i]?.setStretchFactor(1)
      }
    }

    const startIdx = visibleStartIdx(selectedRange, candles)
    chart.timeScale().setVisibleLogicalRange({
      from: startIdx,
      to: candles.length - 1,
    })

    let disposed = false
    const measurePanes = () => {
      if (disposed) return
      try {
        const containerRect = container.getBoundingClientRect()
        let paneIdx = 1
        const rects: IndicatorPaneRects = { rsi: null, macd: null }
        const readPane = (i: number): PaneRect | null => {
          const el = chart.panes()[i]?.getHTMLElement()
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { top: r.top - containerRect.top, height: r.height }
        }
        if (rsiVisible) {
          rects.rsi = readPane(paneIdx++)
        }
        if (macdVisible) {
          rects.macd = readPane(paneIdx++)
        }
        setPaneRects(rects)
      } catch {
        // chart disposed mid-frame; ignore
      }
    }
    requestAnimationFrame(measurePanes)

    chart.subscribeCrosshairMove((param) => {
      if (param.time === undefined) {
        setHoverIndex(null)
        return
      }
      const idx = candles.findIndex((c) => c.time === param.time)
      setHoverIndex(idx >= 0 ? idx : null)
    })

    const observer = new ResizeObserver(() => {
      if (disposed) return
      try {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
        requestAnimationFrame(measurePanes)
      } catch {
        // chart disposed between resize fire and apply; ignore
      }
    })
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      try { chart.remove() } catch { /* already disposed */ }
      chartRef.current = null
      candleSeriesRef.current = null
      setHoverIndex(null)
      setPaneRects({ rsi: null, macd: null })
    }
  }, [
    enabled, containerRef, candles, maArrays, rsiArr, macdResult, ichimoku, palette,
    maVisible, rsiVisible, macdVisible, ichimokuVisible, selectedRange,
  ])

  return { hoverIndex, paneRects, chartRef, candleSeriesRef, chartReady }
}
