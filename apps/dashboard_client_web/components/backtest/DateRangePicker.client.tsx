'use client';

// components/backtest/DateRangePicker.client.tsx
// Purpose: date range selection with presets + NASDAQ mini-chart backdrop.
// Rules enforced: to > from, min 30 trading days (~42 calendar days),
//   start cannot precede the earliest data date of selected assets.
// Mini-chart shows ^IXIC (default) or ^NDX; clicking sets range endpoints.

import { useState, useCallback } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { PricePoint } from '@/types/backtest';

interface DateRangePickerProps {
    from: string;
    to: string;
    minAllowedFrom: string; // earliest data date across selected assets
    ixicSeries: PricePoint[];
    ndxSeries: PricePoint[];
    onChange: (from: string, to: string) => void;
}

const MIN_CALENDAR_DAYS = 42; // ≈30 trading days

type Preset = '1Y' | '3Y' | '5Y' | 'Max';

function subtractYears(date: string, years: number): string {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCFullYear(d.getUTCFullYear() - years);
    return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
    return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

export default function DateRangePicker({
    from,
    to,
    minAllowedFrom,
    ixicSeries,
    ndxSeries,
    onChange,
}: DateRangePickerProps) {
    const [index, setIndex] = useState<'IXIC' | 'NDX'>('IXIC');
    const [clickState, setClickState] = useState<'from' | 'to'>('from');

    const series = index === 'IXIC' ? ixicSeries : ndxSeries;
    // Normalise chart data to percentage of first bar (relative performance view)
    const baseClose = series[0]?.close ?? 1;
    const chartData = series.map((p) => ({
        date: p.date,
        value: parseFloat(((p.close / baseClose) * 100).toFixed(2)),
    }));

    const today = new Date().toISOString().slice(0, 10);

    const setPreset = useCallback(
        (preset: Preset) => {
            const end = today;
            let start: string;
            if (preset === 'Max') {
                start = minAllowedFrom || subtractYears(today, 10);
            } else {
                const years = preset === '1Y' ? 1 : preset === '3Y' ? 3 : 5;
                const candidate = subtractYears(today, years);
                start =
                    candidate < (minAllowedFrom || candidate)
                        ? minAllowedFrom || candidate
                        : candidate;
            }
            if (start < (minAllowedFrom || start))
                start = minAllowedFrom || start;
            onChange(start, end);
        },
        [today, minAllowedFrom, onChange]
    );

    function handleChartClick(payload: unknown) {
        const p = payload as { activeLabel?: string } | null;
        if (!p?.activeLabel) return;
        const clicked = p.activeLabel;
        if (clickState === 'from') {
            const clampedFrom =
                clicked < minAllowedFrom ? minAllowedFrom : clicked;
            onChange(clampedFrom, to);
            setClickState('to');
        } else {
            const diff = daysBetween(from, clicked);
            if (diff < MIN_CALENDAR_DAYS) return; // too short
            onChange(from, clicked);
            setClickState('from');
        }
    }

    const rangeError = (() => {
        if (from < minAllowedFrom)
            return `Start must be ≥ ${minAllowedFrom} (earliest asset data)`;
        if (daysBetween(from, to) < MIN_CALENDAR_DAYS)
            return 'Date range must span at least 30 trading days (~6 weeks).';
        if (from >= to) return 'Start must be before end.';
        return null;
    })();

    const PRESETS: Preset[] = ['1Y', '3Y', '5Y', 'Max'];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">Date Range</span>
                <div className="flex items-center gap-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPreset(p)}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Manual date inputs */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 text-sm">
                    <label className="text-xs text-muted-foreground w-10">
                        From
                    </label>
                    <input
                        type="date"
                        value={from}
                        min={minAllowedFrom}
                        max={to}
                        onChange={(e) => onChange(e.target.value, to)}
                        className="rounded border bg-background px-2 py-1 text-xs"
                    />
                </div>
                <div className="flex items-center gap-1 text-sm">
                    <label className="text-xs text-muted-foreground w-6">
                        To
                    </label>
                    <input
                        type="date"
                        value={to}
                        min={from}
                        max={today}
                        onChange={(e) => onChange(from, e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-xs"
                    />
                </div>
            </div>

            {rangeError && (
                <p className="text-xs text-destructive">{rangeError}</p>
            )}

            {/* Mini NASDAQ backdrop */}
            {chartData.length > 0 && (
                <div className="mt-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                            Reference index:
                        </span>
                        {(['IXIC', 'NDX'] as const).map((idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setIndex(idx)}
                                className={cn(
                                    'rounded px-2 py-0.5 text-xs',
                                    index === idx
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent border'
                                )}
                            >
                                {idx === 'IXIC' ? 'NASDAQ Comp.' : 'NASDAQ 100'}
                            </button>
                        ))}
                        <span className="text-xs text-muted-foreground ml-auto">
                            Click chart to set{' '}
                            {clickState === 'from' ? 'start' : 'end'} date
                        </span>
                    </div>
                    <div className="h-28 w-full">
                        <ResponsiveContainer
                            width="100%"
                            height="100%"
                        >
                            <LineChart
                                data={chartData}
                                onClick={handleChartClick}
                                style={{ cursor: 'crosshair' }}
                            >
                                <XAxis
                                    dataKey="date"
                                    hide
                                />
                                <YAxis
                                    hide
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    formatter={(v) => {
                                        const n = typeof v === 'number' ? v : 0;
                                        return [
                                            `${n.toFixed(1)}`,
                                            'Indexed (base=100)',
                                        ] as [string, string];
                                    }}
                                    labelFormatter={(l) => String(l)}
                                    contentStyle={{ fontSize: 11 }}
                                />
                                <ReferenceLine
                                    x={from}
                                    stroke="#22c55e"
                                    strokeDasharray="3 3"
                                    label={{
                                        value: 'Start',
                                        position: 'top',
                                        fontSize: 10,
                                    }}
                                />
                                <ReferenceLine
                                    x={to}
                                    stroke="#ef4444"
                                    strokeDasharray="3 3"
                                    label={{
                                        value: 'End',
                                        position: 'top',
                                        fontSize: 10,
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    dot={false}
                                    strokeWidth={1.5}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
