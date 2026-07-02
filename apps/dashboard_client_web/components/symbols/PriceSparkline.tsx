// components/symbols/PriceSparkline.tsx
// Purpose: Inline SVG polyline sparkline for per-ticker price history.
// Invariants:
//   - Pure presentational — no hooks, no side effects, no external chart library.
//   - Returns null for empty points (caller may render a fallback note).
//   - Direction signaled by both color AND ▲/▼ symbol (not sole cue).
//   - normalizeSpark handles flat-line and single-point edge cases.
// Constraints: dependency-free inline SVG; ≤120 LOC.

import { normalizeSpark } from '@/utils/sparkline';

const VIEWBOX_W = 240;
const VIEWBOX_H = 64;

interface Props {
    points: { t: string; close: number }[];
}

export function PriceSparkline({ points }: Props) {
    if (points.length === 0) return null;

    const closes = points.map((p) => p.close);
    const coords = normalizeSpark(closes, VIEWBOX_W, VIEWBOX_H);
    const polylinePoints = coords
        .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
        .join(' ');

    // points.length > 0 guaranteed above; non-null assertions are safe.

    const first = closes[0]!;

    const last = closes[closes.length - 1]!;
    const changePct = ((last - first) / first) * 100;
    const isUp = changePct >= 0;

    // green-600 / red-600 — matches Tailwind semantic tokens without needing a class string.
    const strokeColor = isUp ? '#16a34a' : '#dc2626';
    const arrow = isUp ? '▲' : '▼';
    const sign = isUp ? '+' : '';

    const lastFormatted = last.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const changeLabel = `${arrow} ${sign}${changePct.toFixed(2)}%`;

    // points.length > 0 and points.length - 1 >= 0 guaranteed.

    const firstDate = points[0]!.t;

    const lastDate = points[points.length - 1]!.t;

    return (
        <div className="flex flex-col gap-2">
            <svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                width="100%"
                style={{ maxWidth: VIEWBOX_W }}
                preserveAspectRatio="none"
                aria-hidden="true"
                role="img"
            >
                <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </svg>
            <div className="flex items-baseline gap-2 text-sm tabular-nums">
                <span className="font-semibold">${lastFormatted}</span>
                <span
                    className="text-xs font-medium"
                    style={{ color: strokeColor }}
                    aria-label={`Price change: ${changeLabel}`}
                >
                    {changeLabel}
                </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
                {firstDate} — {lastDate} ({points.length}d)
            </p>
        </div>
    );
}
