// components/backtest/StatsTable.tsx
// Purpose: render a month-by-month backtest statistics table.
// Pure Server-compatible component (no hooks/state) — receives pre-computed rows.
// Columns: 월 · 월말평가액 · 월수익률 · 누적수익률 · 낙폭 · 당월배당 · 누적배당
//          + (DCA) 월기여 · 누적투입 + (optional) 자산별 월말 조정close
//          + (optional, X2.17b) 자산별 월말 비중%

import type { MonthlyStatRow } from '@/utils/backtest/monthlyStats';

interface StatsTableProps {
    rows: MonthlyStatRow[];
    /** Selected asset labels to render as trailing price columns (split-adjusted close). */
    assetLabels?: string[];
    /** priceByMonth['YYYY-MM'][label] = month-end split-adjusted close. */
    assetPriceByMonth?: Record<string, Record<string, number>>;
    /** X2.17b: weightByMonth['YYYY-MM'][label] = weight fraction 0–1. */
    assetWeightByMonth?: Record<string, Record<string, number>>;
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

/** Per-asset split-adjusted close: 2 decimals so sub-$1 adjusted prices stay legible. */
function fmtPrice(v: number | undefined): string {
    if (v === undefined) return '—';
    return `$${v.toFixed(2)}`;
}

/** Weight fraction → percentage string, 1 decimal. */
function fmtWeight(v: number | undefined): string {
    if (v === undefined) return '—';
    return `${(v * 100).toFixed(1)}%`;
}

function pctClass(v: number): string {
    if (v > 0) return 'text-green-600 dark:text-green-400';
    if (v < 0) return 'text-red-500 dark:text-red-400';
    return '';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatsTable({
    rows,
    assetLabels,
    assetPriceByMonth,
    assetWeightByMonth,
}: StatsTableProps) {
    if (rows.length === 0) return null;

    const hasDca = rows[0]?.contribution !== undefined;
    const priceLabels = assetLabels ?? [];
    const hasPrices = priceLabels.length > 0 && assetPriceByMonth !== undefined;
    const hasWeights =
        priceLabels.length > 0 &&
        assetWeightByMonth !== undefined &&
        Object.keys(assetWeightByMonth).length > 0;

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
                            {hasPrices &&
                                priceLabels.map((label) => (
                                    <th
                                        key={`price-${label}`}
                                        className="px-3 py-2 font-medium text-right whitespace-nowrap"
                                    >
                                        {label} 가격
                                    </th>
                                ))}
                            {hasWeights &&
                                priceLabels.map((label) => (
                                    <th
                                        key={`weight-${label}`}
                                        className="px-3 py-2 font-medium text-right whitespace-nowrap"
                                    >
                                        {label} 비중
                                    </th>
                                ))}
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
                                {hasPrices &&
                                    priceLabels.map((label) => (
                                        <td
                                            key={`price-${label}`}
                                            className="px-3 py-1.5 text-right font-mono text-muted-foreground"
                                        >
                                            {fmtPrice(
                                                assetPriceByMonth?.[
                                                    row.month
                                                ]?.[label]
                                            )}
                                        </td>
                                    ))}
                                {hasWeights &&
                                    priceLabels.map((label) => (
                                        <td
                                            key={`weight-${label}`}
                                            className="px-3 py-1.5 text-right font-mono text-muted-foreground"
                                        >
                                            {fmtWeight(
                                                assetWeightByMonth?.[
                                                    row.month
                                                ]?.[label]
                                            )}
                                        </td>
                                    ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hasPrices && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    자산별 가격은 월말 종가(분할조정) 기준입니다.
                    {hasWeights &&
                        ' 비중은 월말 NAV 대비 보유 시가총액 기준입니다.'}
                </p>
            )}
        </section>
    );
}
