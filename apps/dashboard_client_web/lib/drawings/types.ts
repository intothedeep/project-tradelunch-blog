// Purpose: Drawing-tool data types. All drawings are anchored in data space
// (time + price). The renderer converts to pixels at draw time so drawings
// remain correct when the user pans/zooms.

export type DrawingKind =
    | 'horizontal_line'
    | 'vertical_line'
    | 'trend_line'
    | 'ray'
    | 'parallel_channel'
    | 'fib_retracement'
    | 'fib_extension';

export interface DrawingPoint {
    time: string | number;
    price: number;
}

export interface BaseDrawing {
    id: string;
    kind: DrawingKind;
    color: string;
    lineWidth: number;
}

export interface HorizontalLineDrawing extends BaseDrawing {
    kind: 'horizontal_line';
    price: number;
}

export interface VerticalLineDrawing extends BaseDrawing {
    kind: 'vertical_line';
    time: string | number;
}

export interface TrendLineDrawing extends BaseDrawing {
    kind: 'trend_line';
    p1: DrawingPoint;
    p2: DrawingPoint;
}

export interface RayDrawing extends BaseDrawing {
    kind: 'ray';
    p1: DrawingPoint;
    p2: DrawingPoint;
}

export interface ParallelChannelDrawing extends BaseDrawing {
    kind: 'parallel_channel';
    p1: DrawingPoint;
    p2: DrawingPoint;
    // Channel offset point: defines the parallel line that passes through p3.
    p3: DrawingPoint;
    fillColor: string;
}

export interface FibRetracementDrawing extends BaseDrawing {
    kind: 'fib_retracement';
    p1: DrawingPoint;
    p2: DrawingPoint;
}

export interface FibExtensionDrawing extends BaseDrawing {
    kind: 'fib_extension';
    p1: DrawingPoint;
    p2: DrawingPoint;
    p3: DrawingPoint;
}

export type Drawing =
    | HorizontalLineDrawing
    | VerticalLineDrawing
    | TrendLineDrawing
    | RayDrawing
    | ParallelChannelDrawing
    | FibRetracementDrawing
    | FibExtensionDrawing;

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const FIB_EXT_LEVELS = [0, 0.618, 1, 1.618, 2.618] as const;

export const POINTS_REQUIRED: Record<DrawingKind, 1 | 2 | 3> = {
    horizontal_line: 1,
    vertical_line: 1,
    trend_line: 2,
    ray: 2,
    parallel_channel: 3,
    fib_retracement: 2,
    fib_extension: 3,
};
