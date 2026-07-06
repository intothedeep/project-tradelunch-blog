// components/backtest/StatsTable.tsx
// Purpose: render a month-by-month backtest statistics table.
// Pure Server-compatible component (no hooks/state) — receives pre-computed rows.
// Columns: 월 · 월말평가액 · 월수익률 · 누적수익률 · 당월배당 · 누적배당
//          + (DCA) 월기여 · 누적투입

import type { MonthlyStatRow } from '@/utils/backtest/monthlyStats';

interface StatsTableProps {
    rows: MonthlyStatRow[];
}

// ── formatters ────────────────────────────────────────────────────────────────

function fmtUsd(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}

function fmtPct(v: number): string {
    return `${(v * 100).toFixed(2)}%`;
}

function fmtDiv(v: number): string {
    if (v === 0) return '—';
    return fmtUsd(v);
}

function pctClass(v: number): string {
    if (v > 0) return 'text-green-600 dark:text-green-400';
    if (v < 0) return 'text-red-500 dark:text-red-400';
    return '';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatsTable({ rows }: StatsTableProps) {
    if (rows.length === 0) return null;

    const hasDca = rows[0]?.contribution !== undefined;

    return (
        <section aria-label="월별 통계표">
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">월</th>
                            <th className="px-3 py-2 font-medium text-right">
                                월말 평가액
                            </th>
                            <th className="px-3 py-2 font-medium text-right">
                                월 수익률
                            </th>
                            <th className="px-3 py-2 font-medium text-right">
                                누적 수익률
                            </th>
                            <th className="px-3 py-2 font-medium text-right">
                                낙폭
                            </th>
                            <th className="px-3 py-2 font-medium text-right">
                                당월 배당
                            </th>
                            <th className="px-3 py-2 font-medium text-right">
                                누적 배당
                            </th>
                            {hasDca && (
                                <>
                                    <th className="px-3 py-2 font-medium text-right">
                                        월 기여
                                    </th>
                                    <th className="px-3 py-2 font-medium text-right">
                                        누적 투입
                                    </th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.month}
                                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                                    {row.month}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                    {fmtUsd(row.endValue)}
                                </td>
                                <td
                                    className={`px-3 py-1.5 text-right font-mono ${pctClass(row.monthReturnPct)}`}
                                >
                                    {fmtPct(row.monthReturnPct)}
                                </td>
                                <td
                                    className={`px-3 py-1.5 text-right font-mono ${pctClass(row.cumulativeReturnPct)}`}
                                >
                                    {fmtPct(row.cumulativeReturnPct)}
                                </td>
                                <td
                                    className={`px-3 py-1.5 text-right font-mono ${row.drawdownPct < 0 ? 'text-red-500 dark:text-red-400' : ''}`}
                                >
                                    {fmtPct(row.drawdownPct)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                    {fmtDiv(row.dividendCash)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                    {fmtDiv(row.cumulativeDividend)}
                                </td>
                                {hasDca && (
                                    <>
                                        <td className="px-3 py-1.5 text-right font-mono">
                                            {fmtDiv(row.contribution ?? 0)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono">
                                            {fmtUsd(
                                                row.totalInvestedToDate ?? 0
                                            )}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
