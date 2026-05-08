// Ray: starts at p1, passes through p2, extends to the right edge of the pane.

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { RayDrawing } from '../types'
import { applyLineStyle, toPixel, type PaneBounds } from '../drawCoords'

export function drawRay(
  ctx: CanvasRenderingContext2D,
  d: RayDrawing,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
  bounds: PaneBounds,
): void {
  const a = toPixel(chart, series, d.p1)
  const b = toPixel(chart, series, d.p2)
  if (!a || !b) return
  applyLineStyle(ctx, d.color, d.lineWidth)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const xEnd = dx >= 0 ? bounds.width : 0
  const t = dx === 0 ? 0 : (xEnd - a.x) / dx
  const yEnd = a.y + t * dy
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(xEnd, yEnd)
  ctx.stroke()
}
