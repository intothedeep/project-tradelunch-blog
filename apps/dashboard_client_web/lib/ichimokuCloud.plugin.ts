// Purpose: Lightweight-charts series primitive that fills the Ichimoku Kumo
// (cloud) between Senkou Span A and Span B. Color flips at A/B crossings,
// with linear interpolation to find the intersection x so each segment is
// rendered as two correctly-colored triangles. Drawn at zOrder 'bottom' so
// candles and overlay lines remain visible on top.

import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'

interface BitmapScope {
  context: CanvasRenderingContext2D
  horizontalPixelRatio: number
  verticalPixelRatio: number
}
interface RenderTarget {
  useBitmapCoordinateSpace: (cb: (scope: BitmapScope) => void) => void
}

export interface CloudPoint {
  time: Time
  spanA: number | null
  spanB: number | null
}

interface ScreenPoint {
  x: number
  yA: number
  yB: number
  spanA: number
  spanB: number
}

class IchimokuCloudRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly chart: IChartApi | null,
    private readonly series: ISeriesApi<SeriesType, Time> | null,
    private readonly data: CloudPoint[],
    private readonly upColor: string,
    private readonly downColor: string,
  ) {}

  draw(target: RenderTarget): void {
    const chart = this.chart
    const series = this.series
    if (!chart || !series) return

    const timeScale = chart.timeScale()
    const points: (ScreenPoint | null)[] = this.data.map((p) => {
      if (p.spanA === null || p.spanB === null) return null
      const x = timeScale.timeToCoordinate(p.time)
      if (x === null) return null
      const yA = series.priceToCoordinate(p.spanA)
      const yB = series.priceToCoordinate(p.spanB)
      if (yA === null || yB === null) return null
      return { x, yA, yB, spanA: p.spanA, spanB: p.spanB }
    })

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      ctx.save()
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio)

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i]
        const p1 = points[i + 1]
        if (!p0 || !p1) continue

        const d0 = p0.spanA - p0.spanB
        const d1 = p1.spanA - p1.spanB
        const sameSide = (d0 >= 0 && d1 >= 0) || (d0 <= 0 && d1 <= 0)

        if (sameSide) {
          ctx.fillStyle = d0 + d1 >= 0 ? this.upColor : this.downColor
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.yA)
          ctx.lineTo(p1.x, p1.yA)
          ctx.lineTo(p1.x, p1.yB)
          ctx.lineTo(p0.x, p0.yB)
          ctx.closePath()
          ctx.fill()
          continue
        }

        const t = d0 / (d0 - d1)
        const xCross = p0.x + t * (p1.x - p0.x)
        const yCross = p0.yA + t * (p1.yA - p0.yA)
        const leftColor = d0 >= 0 ? this.upColor : this.downColor
        const rightColor = d1 >= 0 ? this.upColor : this.downColor

        ctx.fillStyle = leftColor
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.yA)
        ctx.lineTo(xCross, yCross)
        ctx.lineTo(p0.x, p0.yB)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = rightColor
        ctx.beginPath()
        ctx.moveTo(xCross, yCross)
        ctx.lineTo(p1.x, p1.yA)
        ctx.lineTo(p1.x, p1.yB)
        ctx.closePath()
        ctx.fill()
      }

      ctx.restore()
    })
  }
}

class IchimokuCloudPaneView implements IPrimitivePaneView {
  constructor(private readonly owner: IchimokuCloudPrimitive) {}

  zOrder() {
    return 'bottom' as const
  }

  renderer(): IPrimitivePaneRenderer {
    return new IchimokuCloudRenderer(
      this.owner.chart,
      this.owner.series,
      this.owner.data,
      this.owner.upColor,
      this.owner.downColor,
    )
  }
}

export class IchimokuCloudPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null

  constructor(
    public data: CloudPoint[],
    public upColor: string,
    public downColor: string,
  ) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart
    this.series = param.series as ISeriesApi<SeriesType, Time>
  }

  detached(): void {
    this.chart = null
    this.series = null
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [new IchimokuCloudPaneView(this)]
  }

  updateAllViews(): void {}
}
