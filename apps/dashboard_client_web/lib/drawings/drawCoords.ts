// Purpose: Shared coordinate helpers for drawing renderers. Convert a
// (time, price) DrawingPoint into pixel coordinates, returning null when
// either coordinate is unavailable (outside visible range or invalid time).

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { DrawingPoint } from './types'

export interface PixelPoint { x: number; y: number }
export interface PaneBounds { width: number; height: number }

export function toPixel(
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
  pt: DrawingPoint,
): PixelPoint | null {
  const x = chart.timeScale().timeToCoordinate(pt.time as Time)
  const y = series.priceToCoordinate(pt.price)
  if (x === null || y === null) return null
  return { x: x as number, y: y as number }
}

export function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
}
