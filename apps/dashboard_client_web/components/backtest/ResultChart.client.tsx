'use client';

// components/backtest/ResultChart.client.tsx
// Purpose: recharts area/line chart rendering:
//   - Historical portfolio value (solid line)
//   - CAGR projection curve (dashed, visually separated beyond the last date)
//   - Monte Carlo p10/p90 shaded band + p50 median line
// A clear vertical boundary separates historical from projected regions.

import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import type { BacktestResult } from '@/types/backtest';

interface ResultChartProps {
    result: BacktestResult;
    budget: number;
}

function fmt$(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}

// Merge historical timeline + projection into a unified chart dataset.
// Projection points carry undefined for historicalValue so the historical
// line terminates cleanly at the boundary.
interface ChartPoint {
    date: string;
    historicalValue?: number;
    cagrValue?: number;
    p10?: number;
    p50?: number;
    p90?: number;
}

function buildChartData(result: BacktestResult): {
    data: ChartPoint[];
    boundaryDate: string;
} {
    const boundaryDate =
        result.timeline[result.timeline.length - 1]?.date ?? '';

    const histPoints: ChartPoint[] = result.timeline.map((t) => ({
        date: t.date,
        historicalValue: t.value,
    }));

    // Take every 3rd projection month (quarterly) to keep chart readable.
    const projLen = result.projection.cagrCurve.length;
    const step = Math.max(1, Math.floor(projLen / 40));

    const projPoints: ChartPoint[] = result.projection.cagrCurve
        .filter((_, i) => i % step === 0 || i === projLen - 1)
        .map((pt, i) => ({
            date: pt.date,
            cagrValue: pt.value,
            p10: result.projection.monteCarlo[i * step]?.p10,
            p50: result.projection.monteCarlo[i * step]?.p50,
            p90: result.projection.monteCarlo[i * step]?.p90,
        }));

    return { data: [...histPoints, ...projPoints], boundaryDate };
}

export default function ResultChart({ result, budget }: ResultChartProps) {
    const { data, boundaryDate } = buildChartData(result);
    const hasDividends = result.dividends.total > 0;

    return (
        <section aria-label="Portfolio performance chart">
            <h2 className="text-sm font-semibold mb-2">
                Performance &amp; 10-Year Projection
                {hasDividends && (
                    <span className="ml-2 text-xs text-muted-foreground">
                        (includes dividends)
                    </span>
                )}
            </h2>
            <div className="h-72 w-full">
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    <ComposedChart
                        data={data}
                        margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            strokeOpacity={0.1}
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v: string) => v.slice(0, 7)}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v: number) => fmt$(v)}
                            width={60}
                        />
                        <Tooltip
                            formatter={(v, name) => {
                                const n = typeof v === 'number' ? v : 0;
                                return [fmt$(n), String(name ?? '')] as [
                                    string,
                                    string,
                                ];
                            }}
                            labelFormatter={(l) => String(l)}
                            contentStyle={{ fontSize: 11 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />

                        {/* Historical/projected boundary */}
                        {boundaryDate && (
                            <ReferenceLine
                                x={boundaryDate}
                                stroke="#888"
                                strokeDasharray="4 2"
                                label={{
                                    value: 'Today',
                                    position: 'insideTopRight',
                                    fontSize: 10,
                                }}
                            />
                        )}

                        {/* Budget baseline */}
                        <ReferenceLine
                            y={budget}
                            stroke="#aaa"
                            strokeDasharray="2 2"
                        />

                        {/* Monte Carlo band */}
                        <Area
                            type="monotone"
                            dataKey="p90"
                            fill="#6366f133"
                            stroke="none"
                            name="MC p90"
                            legendType="none"
                        />
                        <Area
                            type="monotone"
                            dataKey="p10"
                            fill="#ffffff"
                            stroke="none"
                            name="MC p10"
                            legendType="none"
                        />

                        {/* Historical portfolio value */}
                        <Line
                            type="monotone"
                            dataKey="historicalValue"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                            name="Portfolio"
                            connectNulls={false}
                        />

                        {/* CAGR curve */}
                        <Line
                            type="monotone"
                            dataKey="cagrValue"
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            strokeDasharray="5 3"
                            dot={false}
                            name="CAGR proj."
                            connectNulls={false}
                        />

                        {/* Monte Carlo median */}
                        <Line
                            type="monotone"
                            dataKey="p50"
                            stroke="#a78bfa"
                            strokeWidth={1}
                            strokeDasharray="2 2"
                            dot={false}
                            name="MC median"
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            {/* Monte Carlo fan disclaimer — period cherry-picking + leveraged asset caveat */}
            <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                Projection fan extrapolated from the{' '}
                <em>selected period&apos;s</em> realized μ/σ (period
                cherry-picking risk). For leveraged assets (TQQQ/QLD/SOXL) the
                iid-normal model does not capture volatility decay.
            </p>
        </section>
    );
}
