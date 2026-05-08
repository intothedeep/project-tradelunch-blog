import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { TrendLineDrawing } from '../types'
import { applyLineStyle, toPixel } from '../drawCoords'

export function drawTrendLine(
  ctx: CanvasRenderingContext2D,
  d: TrendLineDrawing,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
): void {
  const a = toPixel(chart, series, d.p1)
  const b = toPixel(chart, series, d.p2)
  if (!a || !b) return
  applyLineStyle(ctx, d.color, d.lineWidth)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}
