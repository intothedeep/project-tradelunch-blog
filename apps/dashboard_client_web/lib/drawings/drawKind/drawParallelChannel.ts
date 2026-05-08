// Parallel channel: main line p1->p2, parallel line offset by (p3 - line(p1,p2))
// projected perpendicularly. Filled between the two lines.

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { ParallelChannelDrawing } from '../types'
import { applyLineStyle, toPixel } from '../drawCoords'

export function drawParallelChannel(
  ctx: CanvasRenderingContext2D,
  d: ParallelChannelDrawing,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
): void {
  const a = toPixel(chart, series, d.p1)
  const b = toPixel(chart, series, d.p2)
  const c = toPixel(chart, series, d.p3)
  if (!a || !b || !c) return

  // The parallel line shares slope with line(a,b) but passes through c.
  // We compute the y-offset measured along the y-axis at the x of c.
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0) return
  const slope = dy / dx
  const yOnAB = a.y + slope * (c.x - a.x)
  const offset = c.y - yOnAB

  const a2 = { x: a.x, y: a.y + offset }
  const b2 = { x: b.x, y: b.y + offset }

  ctx.fillStyle = d.fillColor
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.lineTo(a2.x, a2.y)
  ctx.closePath()
  ctx.fill()

  applyLineStyle(ctx, d.color, d.lineWidth)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.moveTo(a2.x, a2.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.stroke()
}
