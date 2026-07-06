// components/backtest/YearlyTable.tsx
// Purpose: render a per-year table of year-end value + rolling annualised return
//   (누적 연환산 CAGR). Pure component — receives pre-computed rows.
// Semantics: lump-sum → time-weighted CAGR-to-date; DCA → XIRR-to-date (matches
//   the MetricsPanel headline, so the last row reconciles). See yearlyStats.ts.

import type { YearlyStatRow } from '@/utils/backtest/yearlyStats';

interface YearlyTableProps {
    rows: YearlyStatRow[];
    /** true when the run has DCA contributions → header labels the metric as XIRR. */
    isDca?: boolean;
}

function fmtUsd(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
    if (v === null) return '—';
    return `${(v * 100).toFixed(2)}%`;
}

function pctClass(v: number | null): string {
    if (v === null) return '';
    if (v > 0) return 'text-green-600 dark:text-green-400';
    if (v < 0) return 'text-red-500 dark:text-red-400';
    return '';
}

export default function YearlyTable({ rows, isDca }: YearlyTableProps) {
    if (rows.length === 0) return null;

    const cagrLabel = isDca ? '누적 연환산 (XIRR)' : '누적 연환산 CAGR';

    return (
        <section aria-label="연도별 통계표">
            <h3 className="mb-2 text-sm font-medium">연도별</h3>
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">연도</th>
                            <th className="px-3 py-2 font-medium text-right">
                                연말 평가액
                            </th>
                            <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                                {cagrLabel}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.year}
                                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                                    {row.year}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                    {fmtUsd(row.endValue)}
                                </td>
                                <td
                                    className={`px-3 py-1.5 text-right font-mono ${pctClass(row.annualizedReturnPct)}`}
                                >
                                    {fmtPct(row.annualizedReturnPct)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
                {isDca
                    ? '적립식: 시작~각 연말까지 실제 납입 시점을 반영한 연환산 수익률(XIRR).'
                    : '시작~각 연말까지의 연평균 복리 수익률(CAGR).'}
            </p>
        </section>
    );
}
