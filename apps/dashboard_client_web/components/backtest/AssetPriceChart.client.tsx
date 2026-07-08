'use client';

// components/backtest/AssetPriceChart.client.tsx
// Purpose: normalized price-change line chart for selected assets.
// Each series is indexed to 100 at the first in-range bar so different
// price scales are comparable. Separate from the portfolio-value ResultChart.

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import type { PricePoint } from '@/types/backtest';

interface AssetPriceChartProps {
    seriesData: Record<string, PricePoint[]>;
    labels: string[];
    from: string;
    to: string;
    realInception?: string;
    /** Rebalance event dates (YYYY-MM-DD) — rendered as vertical dashed lines. */
    rebalanceDates?: string[];
}

// Distinct color palette — cycles by label index.
const COLORS = [
    '#6366f1', // indigo
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#a78bfa', // violet
    '#f97316', // orange
    '#84cc16', // lime
];

type ChartRow = Record<string, string | number>;

function buildChartData(
    seriesData: Record<string, PricePoint[]>,
    labels: string[],
    from: string,
    to: string
): ChartRow[] {
    // For each label, build a date→indexedValue map using bars in [from, to].
    const labelMaps: Record<string, Map<string, number>> = {};

    for (const label of labels) {
        const pts = seriesData[label];
        if (!pts || pts.length === 0) continue;

        const inRange = pts.filter((p) => p.date >= from && p.date <= to);
        if (inRange.length === 0) continue;

        const firstPt = inRange[0];
        if (!firstPt || firstPt.close === 0) continue;

        const firstClose = firstPt.close;
        const map = new Map<string, number>();
        for (const p of inRange) {
            map.set(
                p.date,
                Math.round((p.close / firstClose) * 100 * 100) / 100
            );
        }
        labelMaps[label] = map;
    }

    // Collect all unique dates across all labels, sorted ascending.
    const dateSet = new Set<string>();
    for (const map of Object.values(labelMaps)) {
        for (const date of map.keys()) {
            dateSet.add(date);
        }
    }
    const dates = Array.from(dateSet).sort();

    // Merge into a single array — omit label key when no bar on that date.
    return dates.map((date) => {
        const row: ChartRow = { date };
        for (const label of labels) {
            const val = labelMaps[label]?.get(date);
            if (val !== undefined) {
                row[label] = val;
            }
        }
        return row;
    });
}

export default function AssetPriceChart({
    seriesData,
    labels,
    from,
    to,
    realInception,
    rebalanceDates,
}: AssetPriceChartProps) {
    const activeLabels = labels.filter(
        (l) => l && seriesData[l] && seriesData[l].length > 0
    );

    if (activeLabels.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                표시할 데이터가 없습니다.
            </p>
        );
    }

    const data = buildChartData(seriesData, activeLabels, from, to);

    if (data.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                표시할 데이터가 없습니다.
            </p>
        );
    }

    // Filter rebalance dates to those present in chart data (daily YYYY-MM-DD).
    const dataDateSet = new Set(data.map((row) => row.date as string));
    const activeRebalanceDates = (rebalanceDates ?? []).filter((d) =>
        dataDateSet.has(d)
    );

    // Only show realInception reference line when it falls within the range.
    const showInceptionLine =
        realInception !== undefined &&
        realInception >= from &&
        realInception <= to;

    return (
        <section aria-label="자산 가격 지수 차트">
            <h2 className="text-sm font-semibold mb-2">
                자산 가격 변화 (시작=100 기준 지수)
            </h2>
            <div className="h-80 w-full">
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    <LineChart
                        data={data}
                        margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                    >
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v: string) => v.slice(0, 7)}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            width={52}
                            label={{
                                value: '지수 (시작=100)',
                                angle: -90,
                                position: 'insideLeft',
                                fontSize: 9,
                                offset: 8,
                            }}
                        />
                        <Tooltip
                            formatter={(v, name) => {
                                const n = typeof v === 'number' ? v : 0;
                                return [n.toFixed(2), String(name ?? '')] as [
                                    string,
                                    string,
                                ];
                            }}
                            labelFormatter={(l) => String(l)}
                            contentStyle={{ fontSize: 11 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />

                        {showInceptionLine && (
                            <ReferenceLine
                                x={realInception}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                label={{
                                    value: '실제 시작',
                                    position: 'insideTopLeft',
                                    fontSize: 9,
                                    fill: '#f59e0b',
                                }}
                            />
                        )}

                        {/* Rebalance event markers */}
                        {activeRebalanceDates.map((d) => (
                            <ReferenceLine
                                key={d}
                                x={d}
                                stroke="#6366f1"
                                strokeOpacity={0.5}
                                strokeDasharray="2 2"
                                strokeWidth={1}
                            />
                        ))}

                        {activeLabels.map((label, i) => (
                            <Line
                                key={label}
                                type="monotone"
                                dataKey={label}
                                stroke={COLORS[i % COLORS.length]}
                                strokeWidth={1.5}
                                dot={false}
                                connectNulls={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                각 자산의 분할조정 종가를 선택 기간 첫 거래일 기준 100으로
                정규화한 지수입니다.
            </p>
            {activeRebalanceDates.length > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                    세로 점선 = 리밸런싱 시점
                </p>
            )}
        </section>
    );
}
