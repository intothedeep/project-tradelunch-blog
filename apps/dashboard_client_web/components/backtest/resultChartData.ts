// components/backtest/resultChartData.ts
// Pure data-shaping helpers for ResultChart — no React / recharts-JSX deps.
// Extracted from ResultChart.client.tsx (X2-P2b refactor, LOC trim).

import type { BacktestResult } from '@/types/backtest';

export interface ChartPoint {
    date: string;
    historicalValue?: number;
    cagrValue?: number;
    p10?: number;
    p50?: number;
    p90?: number;
    /** cmp mode: reg full-span value over the synthetic span. */
    synthRegValue?: number;
    /** cmp/str mode: str full-span value over the synthetic span. */
    synthStrValue?: number;
}

export function fmt$(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}

/** Build chart data for single-method (reg or str) or synth-off mode. */
export function buildChartData(
    result: BacktestResult,
    timelineOverride?: BacktestResult['timeline']
): { data: ChartPoint[]; boundaryDate: string } {
    const timeline = timelineOverride ?? result.timeline;
    const boundaryDate = timeline[timeline.length - 1]?.date ?? '';
    const histPoints: ChartPoint[] = timeline.map((t) => ({
        date: t.date,
        historicalValue: t.value,
    }));
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

/**
 * Build chart data for cmp mode: real line + reg synth + str synth over the
 * synthetic span (before realInception), then real-only for the real span.
 */
export function buildCmpChartData(
    result: BacktestResult,
    regTimeline: BacktestResult['timeline'],
    strTimeline: BacktestResult['timeline'],
    realInception: string
): { data: ChartPoint[]; boundaryDate: string } {
    const pointMap = new Map<string, ChartPoint>();

    // reg full-span: synthRegValue for pre-inception dates
    for (const pt of regTimeline) {
        if (pt.date < realInception) {
            pointMap.set(pt.date, {
                ...(pointMap.get(pt.date) ?? { date: pt.date }),
                synthRegValue: pt.value,
            });
        } else {
            // real portion from reg timeline → historicalValue
            const existing = pointMap.get(pt.date) ?? { date: pt.date };
            if (existing.historicalValue === undefined) {
                pointMap.set(pt.date, {
                    ...existing,
                    historicalValue: pt.value,
                });
            }
        }
    }

    // str full-span: synthStrValue for pre-inception dates
    for (const pt of strTimeline) {
        if (pt.date < realInception) {
            const existing = pointMap.get(pt.date) ?? { date: pt.date };
            pointMap.set(pt.date, {
                ...existing,
                synthStrValue: pt.value,
            });
        }
    }

    // Ensure the real-only result fills the real span (pass-1 timeline)
    for (const pt of result.timeline) {
        const existing = pointMap.get(pt.date) ?? { date: pt.date };
        if (existing.historicalValue === undefined) {
            pointMap.set(pt.date, {
                ...existing,
                historicalValue: pt.value,
            });
        }
    }

    const sorted = [...pointMap.values()].sort((a, b) =>
        a.date < b.date ? -1 : 1
    );
    const boundaryDate =
        result.timeline[result.timeline.length - 1]?.date ?? '';

    // Append projection points
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

    return { data: [...sorted, ...projPoints], boundaryDate };
}
