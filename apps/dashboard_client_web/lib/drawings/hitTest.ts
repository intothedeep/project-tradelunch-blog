// Purpose: pixel-space hit-testing for drawings. Returns the topmost drawing
// id whose geometry is within HIT_PX of (x, y), or null. Iterates drawings
// from last (most recently added) to first so newer drawings win selection.

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { Drawing, FibRetracementDrawing } from './types'
import { FIB_LEVELS } from './types'
import { toPixel } from './drawCoords'

const HIT_PX = 6

export function hitTestDrawings(
  drawings: Drawing[],
  x: number,
  y: number,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
): string | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i]
    if (!d) continue
    if (hits(d, x, y, chart, series)) return d.id
  }
  return null
}

function hits(
  d: Drawing,
  x: number,
  y: number,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
): boolean {
  switch (d.kind) {
    case 'horizontal_line': {
      const py = series.priceToCoordinate(d.price)
      return py !== null && Math.abs(y - (py as number)) < HIT_PX
    }
    case 'vertical_line': {
      const px = chart.timeScale().timeToCoordinate(d.time as Time)
      return px !== null && Math.abs(x - (px as number)) < HIT_PX
    }
    case 'trend_line': {
      const a = toPixel(chart, series, d.p1)
      const b = toPixel(chart, series, d.p2)
      if (!a || !b) return false
      return distToSegment(x, y, a.x, a.y, b.x, b.y) < HIT_PX
    }
    case 'ray': {
      const a = toPixel(chart, series, d.p1)
      const b = toPixel(chart, series, d.p2)
      if (!a || !b) return false
      const dx = b.x - a.x
      if (dx === 0) return false
      const t = (x - a.x) / dx
      if (dx > 0 && t < 0) return false
      if (dx < 0 && t > 0) return false
      return distToSegment(x, y, a.x, a.y, a.x + 1e6 * dx, a.y + 1e6 * (b.y - a.y)) < HIT_PX
    }
    case 'parallel_channel': {
      const a = toPixel(chart, series, d.p1)
      const b = toPixel(chart, series, d.p2)
      const c = toPixel(chart, series, d.p3)
      if (!a || !b || !c) return false
      const dx = b.x - a.x
      if (dx === 0) return false
      const slope = (b.y - a.y) / dx
      const yOnAB = a.y + slope * (c.x - a.x)
      const offset = c.y - yOnAB
      const a2 = { x: a.x, y: a.y + offset }
      const b2 = { x: b.x, y: b.y + offset }
      return (
        distToSegment(x, y, a.x, a.y, b.x, b.y) < HIT_PX ||
        distToSegment(x, y, a2.x, a2.y, b2.x, b2.y) < HIT_PX
      )
    }
    case 'fib_retracement':
      return fibHits(d, x, y, chart, series)
    case 'fib_extension': {
      // Hit the impulse leg or the projection levels around p3.
      const a = toPixel(chart, series, d.p1)
      const b = toPixel(chart, series, d.p2)
      if (!a || !b) return false
      return distToSegment(x, y, a.x, a.y, b.x, b.y) < HIT_PX
    }
  }
}

function fibHits(
  d: FibRetracementDrawing,
  x: number,
  y: number,
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
): boolean {
  const a = toPixel(chart, series, d.p1)
  const b = toPixel(chart, series, d.p2)
  if (!a || !b) return false
  const xLeft = Math.min(a.x, b.x)
  const xRight = Math.max(a.x, b.x)
  if (x < xLeft - HIT_PX || x > xRight + HIT_PX) return false
  const priceHigh = Math.max(d.p1.price, d.p2.price)
  const priceLow = Math.min(d.p1.price, d.p2.price)
  for (const lvl of FIB_LEVELS) {
    const price = priceLow + lvl * (priceHigh - priceLow)
    const py = series.priceToCoordinate(price)
    if (py === null) continue
    if (Math.abs(y - (py as number)) < HIT_PX) return true
  }
  return false
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}
