import type { ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { HorizontalLineDrawing } from '../types'
import { applyLineStyle, type PaneBounds } from '../drawCoords'

export function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  d: HorizontalLineDrawing,
  series: ISeriesApi<SeriesType, Time>,
  bounds: PaneBounds,
): void {
  const y = series.priceToCoordinate(d.price)
  if (y === null) return
  applyLineStyle(ctx, d.color, d.lineWidth)
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(bounds.width, y)
  ctx.stroke()
}
