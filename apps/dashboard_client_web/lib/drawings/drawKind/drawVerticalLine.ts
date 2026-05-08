import type { IChartApi, Time } from 'lightweight-charts'
import type { VerticalLineDrawing } from '../types'
import { applyLineStyle, type PaneBounds } from '../drawCoords'

export function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  d: VerticalLineDrawing,
  chart: IChartApi,
  bounds: PaneBounds,
): void {
  const x = chart.timeScale().timeToCoordinate(d.time as Time)
  if (x === null) return
  applyLineStyle(ctx, d.color, d.lineWidth)
  ctx.beginPath()
  ctx.moveTo(x as number, 0)
  ctx.lineTo(x as number, bounds.height)
  ctx.stroke()
}
