// Purpose: lightweight-charts series primitive that renders all chart drawings
// (lines, channels, fibonacci) in a single canvas pass. Drawn at zOrder 'top'
// so user drawings sit above candles and indicators.

import type {
    IChartApi,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    ISeriesApi,
    ISeriesPrimitive,
    SeriesAttachedParameter,
    SeriesType,
    Time,
} from 'lightweight-charts';
import { renderDrawings, type RenderInput } from './renderer';

interface BitmapScope {
    context: CanvasRenderingContext2D;
    horizontalPixelRatio: number;
    verticalPixelRatio: number;
    mediaSize: { width: number; height: number };
}
interface RenderTarget {
    useBitmapCoordinateSpace: (cb: (scope: BitmapScope) => void) => void;
}

class DrawingsRenderer implements IPrimitivePaneRenderer {
    constructor(
        private readonly chart: IChartApi | null,
        private readonly series: ISeriesApi<SeriesType, Time> | null,
        private readonly input: RenderInput
    ) {}

    draw(target: RenderTarget): void {
        const chart = this.chart;
        const series = this.series;
        if (!chart || !series) return;
        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.save();
            ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
            const bounds = {
                width: scope.mediaSize.width,
                height: scope.mediaSize.height,
            };
            renderDrawings(ctx, chart, series, bounds, this.input);
            ctx.restore();
        });
    }
}

class DrawingsPaneView implements IPrimitivePaneView {
    constructor(private readonly owner: DrawingsPrimitive) {}
    zOrder() {
        return 'top' as const;
    }
    renderer(): IPrimitivePaneRenderer {
        return new DrawingsRenderer(
            this.owner.chart,
            this.owner.series,
            this.owner.input
        );
    }
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
    chart: IChartApi | null = null;
    series: ISeriesApi<SeriesType, Time> | null = null;
    input: RenderInput;

    private requestUpdate: (() => void) | null = null;

    constructor(initial: RenderInput) {
        this.input = initial;
    }

    attached(param: SeriesAttachedParameter<Time>): void {
        this.chart = param.chart;
        this.series = param.series as ISeriesApi<SeriesType, Time>;
        this.requestUpdate = param.requestUpdate;
    }

    detached(): void {
        this.chart = null;
        this.series = null;
        this.requestUpdate = null;
    }

    setInput(input: RenderInput): void {
        this.input = input;
        this.requestUpdate?.();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return [new DrawingsPaneView(this)];
    }

    updateAllViews(): void {}
}
