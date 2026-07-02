// components/symbols/PriceChart.tsx
// Purpose: Full-width SVG area chart for per-ticker daily price history.
//   An expansion of the earlier sparkline — same pure geometry (normalizeSpark),
//   plus a filled area, min/max/last price reference lines, and a date axis.
// Invariants:
//   - Pure presentational — no hooks, no side effects, no external chart library.
//   - Returns null for empty points (caller renders a fallback note).
//   - Direction signaled by both color AND ▲/▼ symbol (never color alone).
//   - normalizeSpark handles flat-line and single-point edge cases.
// Constraints: dependency-free inline SVG; ≤160 LOC.

import { normalizeSpark } from '@/utils/sparkline';

// Outer viewBox; inner plot area is inset by the margins for axis labels.
const W = 640;
const H = 240;
const M = { top: 16, right: 56, bottom: 24, left: 8 };
const INNER_W = W - M.left - M.right;
const INNER_H = H - M.top - M.bottom;

interface Props {
    points: { t: string; close: number }[];
}

function fmtPrice(v: number): string {
    return v.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function PriceChart({ points }: Props) {
    if (points.length === 0) return null;

    const closes = points.map((p) => p.close);
    const coords = normalizeSpark(closes, INNER_W, INNER_H);
    const linePoints = coords
        .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
        .join(' ');

    // Closed area path: baseline → line → back to baseline.
    const first = coords[0]!;
    const lastCoord = coords[coords.length - 1]!;
    const areaPath =
        `M ${first.x.toFixed(1)},${INNER_H} ` +
        coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
        ` L ${lastCoord.x.toFixed(1)},${INNER_H} Z`;

    const firstClose = closes[0]!;
    const lastClose = closes[closes.length - 1]!;
    const maxClose = Math.max(...closes);
    const minClose = Math.min(...closes);
    const changePct = ((lastClose - firstClose) / firstClose) * 100;
    const isUp = changePct >= 0;

    // green-600 / red-600 — Tailwind semantic tokens, inlined for the SVG.
    const color = isUp ? '#16a34a' : '#dc2626';
    const arrow = isUp ? '▲' : '▼';
    const sign = isUp ? '+' : '';
    const changeLabel = `${arrow} ${sign}${changePct.toFixed(2)}%`;
    const gradId = `price-area-${isUp ? 'up' : 'down'}`;

    return (
        <div className="flex flex-col gap-2">
            <div className="mb-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-2xl font-semibold">
                    ${fmtPrice(lastClose)}
                </span>
                <span
                    className="text-sm font-medium"
                    style={{ color }}
                    aria-label={`Price change over range: ${changeLabel}`}
                >
                    {changeLabel}
                </span>
            </div>

            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Daily price chart, ${points[0]!.t} to ${points[points.length - 1]!.t}, ${changeLabel}`}
            >
                <defs>
                    <linearGradient
                        id={gradId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor={color}
                            stopOpacity="0.22"
                        />
                        <stop
                            offset="100%"
                            stopColor={color}
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>

                <g transform={`translate(${M.left}, ${M.top})`}>
                    {/* max/min reference lines */}
                    <line
                        x1="0"
                        y1="0"
                        x2={INNER_W}
                        y2="0"
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeDasharray="3 3"
                    />
                    <line
                        x1="0"
                        y1={INNER_H}
                        x2={INNER_W}
                        y2={INNER_H}
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeDasharray="3 3"
                    />
                    <path
                        d={areaPath}
                        fill={`url(#${gradId})`}
                        stroke="none"
                    />
                    <polyline
                        points={linePoints}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <circle
                        cx={lastCoord.x}
                        cy={lastCoord.y}
                        r="2.5"
                        fill={color}
                    />
                </g>

                {/* y-axis price labels (right gutter) */}
                <text
                    x={W - M.right + 6}
                    y={M.top + 4}
                    className="fill-muted-foreground"
                    fontSize="11"
                >
                    ${fmtPrice(maxClose)}
                </text>
                <text
                    x={W - M.right + 6}
                    y={M.top + INNER_H}
                    className="fill-muted-foreground"
                    fontSize="11"
                >
                    ${fmtPrice(minClose)}
                </text>
            </svg>

            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{points[0]!.t}</span>
                <span>
                    {points[points.length - 1]!.t} ({points.length}d)
                </span>
            </div>
        </div>
    );
}
