'use client';

// components/backtest/ResultChart.client.tsx
// Purpose: recharts area/line chart rendering — historical portfolio value,
// CAGR projection, Monte Carlo fan, synthetic span overlay.
// X2-P2.10: synthetic span shading + non-dismissible SYNTHETIC banner.
// X2-P2b.12: cmp mode — overlay BOTH synthetic lines (reg + str) with distinct
//   styles over the synthetic span; real line stays solid.
//   Shared guardrail: SYNTHETIC banner rendered via SynthBanner (no bypass).

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
    ReferenceArea,
} from 'recharts';
import type { BacktestResult } from '@/types/backtest';
import type { SynthPassMeta } from '@/utils/backtest/synth-passes';
import { SynthBanner } from './SynthGuardrail';
import { fmt$, buildChartData, buildCmpChartData } from './resultChartData';

interface ResultChartProps {
    result: BacktestResult;
    budget: number;
    /** Synth metadata — when present, renders shading + banner. */
    synthMeta?: SynthPassMeta;
    /** Full-span timeline (reg or str); used for single-method synth chart. */
    fullTimeline?: BacktestResult['timeline'];
    /** str full-span timeline — only provided in cmp mode. */
    strFullTimeline?: BacktestResult['timeline'];
    /** Active synth method — drives cmp overlay logic. */
    synthMethod?: 'reg' | 'str' | 'cmp';
}

export default function ResultChart({
    result,
    budget,
    synthMeta,
    fullTimeline,
    strFullTimeline,
    synthMethod,
}: ResultChartProps) {
    const isCmp =
        synthMethod === 'cmp' &&
        fullTimeline !== undefined &&
        strFullTimeline !== undefined &&
        synthMeta !== undefined;

    const { data, boundaryDate } = isCmp
        ? buildCmpChartData(
              result,
              fullTimeline!,
              strFullTimeline!,
              synthMeta!.realInception
          )
        : buildChartData(result, fullTimeline);

    const hasDividends = result.dividends.total > 0;
    const synthStart = isCmp ? fullTimeline![0]?.date : fullTimeline?.[0]?.date;

    return (
        <section aria-label="Portfolio performance chart">
            {/* Shared SYNTHETIC guardrail banner — rendered via SynthBanner; no bypass. */}
            {synthMeta && (
                <SynthBanner
                    method={synthMethod ?? 'reg'}
                    meta={synthMeta}
                    className="mb-2"
                />
            )}
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

                        {/* Shade synthetic span (both methods) */}
                        {synthMeta && synthStart && (
                            <ReferenceArea
                                x1={synthStart}
                                x2={synthMeta.realInception}
                                fill="#f59e0b"
                                fillOpacity={0.07}
                                strokeOpacity={0}
                            />
                        )}

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

                        {/* Synthetic inception boundary */}
                        {synthMeta && (
                            <ReferenceLine
                                x={synthMeta.realInception}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                label={{
                                    value: 'Real start',
                                    position: 'insideTopLeft',
                                    fontSize: 9,
                                    fill: '#f59e0b',
                                }}
                            />
                        )}

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

                        {/* M1 Regression synth line (cmp mode only, over synth span) */}
                        {isCmp && (
                            <Line
                                type="monotone"
                                dataKey="synthRegValue"
                                stroke="#f97316"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                                dot={false}
                                name="M1 Reg (synth)"
                                connectNulls={false}
                            />
                        )}

                        {/* M2 Structural synth line (cmp mode only, over synth span) */}
                        {isCmp && (
                            <Line
                                type="monotone"
                                dataKey="synthStrValue"
                                stroke="#a78bfa"
                                strokeWidth={1.5}
                                strokeDasharray="2 4"
                                dot={false}
                                name="M2 Str (synth)"
                                connectNulls={false}
                            />
                        )}

                        {/* Historical portfolio value (solid — real data) */}
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
            <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                Projection fan extrapolated from the{' '}
                <em>selected period&apos;s</em> realized μ/σ (period
                cherry-picking risk). For leveraged assets (TQQQ/QLD/SOXL) the
                iid-normal model does not capture volatility decay.
            </p>
        </section>
    );
}
