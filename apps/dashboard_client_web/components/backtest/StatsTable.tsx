// components/backtest/StatsTable.tsx
// Purpose: render a month-by-month backtest statistics table.
// Pure Server-compatible component (no hooks/state) — receives pre-computed rows.
// Columns: 월 · 월말평가액 · 월수익률 · 누적수익률 · 낙폭 · 당월배당 · 누적배당
//          + (DCA) 월기여 · 누적투입
//          + (optional, T3) 자산별 월 매수액 (배당재투자+납입+입금)
//          + (optional) 자산별 월말 조정close
//          + (optional, X2.17b) 자산별 월말 비중%
//          + (optional, Task B) 자산별 월말 보유수량 (price 셀 내 아래쪽 표시)
// X2-P2.11: rows in the synthetic span (< realInception month) get a SYNTH tag.

import type { MonthlyStatRow } from '@/utils/backtest/monthlyStats';
import {
    fmtUsd,
    fmtPct,
    fmtDiv,
    fmtPrice,
    fmtWeight,
    fmtShares,
    pctClass,
} from '@/components/backtest/statsTable.format';

interface StatsTableProps {
    rows: MonthlyStatRow[];
    /** Selected asset labels to render as trailing price columns (split-adjusted close). */
    assetLabels?: string[];
    /** priceByMonth['YYYY-MM'][label] = month-end split-adjusted close. */
    assetPriceByMonth?: Record<string, Record<string, number>>;
    /** X2.17b: weightByMonth['YYYY-MM'][label] = weight fraction 0–1. */
    assetWeightByMonth?: Record<string, Record<string, number>>;
    /** Task B: sharesByMonth['YYYY-MM'][label] = fractional share count. */
    assetSharesByMonth?: Record<string, Record<string, number>>;
    /**
     * T3: purchasesByMonth['YYYY-MM'][label] = USD deployed into new shares that month.
     * Covers DRIP/cross-asset reinvestment + contributions + manual deposits.
     * Excludes initial lump-sum and rebalance trades.
     */
    assetPurchasesByMonth?: Record<string, Record<string, number>>;
    /** X2-P2.11: rows where month < realInception's YYYY-MM are tagged SYNTH. */
    realInception?: string;
    /** YYYY-MM set of months that had a rebalance event. */
    rebalanceMonths?: Set<string>;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatsTable({
    rows,
    assetLabels,
    assetPriceByMonth,
    assetWeightByMonth,
    assetSharesByMonth,
    assetPurchasesByMonth,
    realInception,
    rebalanceMonths,
}: StatsTableProps) {
    if (rows.length === 0) return null;

    const hasDca = rows[0]?.contribution !== undefined;
    const priceLabels = assetLabels ?? [];
    const hasPrices = priceLabels.length > 0 && assetPriceByMonth !== undefined;
    const hasWeights =
        priceLabels.length > 0 &&
        assetWeightByMonth !== undefined &&
        Object.keys(assetWeightByMonth).length > 0;
    const hasShares =
        priceLabels.length > 0 &&
        assetSharesByMonth !== undefined &&
        Object.keys(assetSharesByMonth).length > 0;
    // hasPurchases: only when data is present AND has ≥1 month key.
    // Pure lump-sum + cash-dividend + no-rebalance backtests produce no perAssetPurchases
    // so this stays false and no new columns appear for those cases.
    const hasPurchases =
        priceLabels.length > 0 &&
        assetPurchasesByMonth !== undefined &&
        Object.keys(assetPurchasesByMonth).length > 0;

    // X2-P2.11: synthetic month boundary (exclusive) — 'YYYY-MM' prefix.
    const synthMonthBound = realInception
        ? realInception.slice(0, 7)
        : undefined;

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
                            {hasPurchases &&
                                priceLabels.map((label) => (
                                    <th
                                        key={`buy-${label}`}
                                        className="px-3 py-2 font-medium text-right whitespace-nowrap"
                                    >
                                        {label} 매수
                                    </th>
                                ))}
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
                        {rows.map((row) => {
                            const isSynth =
                                synthMonthBound !== undefined &&
                                row.month < synthMonthBound;
                            const isRebalance =
                                rebalanceMonths !== undefined &&
                                rebalanceMonths.size > 0 &&
                                rebalanceMonths.has(row.month);
                            return (
                                <tr
                                    key={row.month}
                                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                                        {row.month}
                                        {isSynth && (
                                            <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                                SYNTH
                                            </span>
                                        )}
                                        {isRebalance && (
                                            <span className="ml-1 rounded bg-indigo-500/20 px-1 text-[9px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                리밸런싱
                                            </span>
                                        )}
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
                                    {hasPurchases &&
                                        priceLabels.map((label) => {
                                            const buyVal =
                                                assetPurchasesByMonth?.[
                                                    row.month
                                                ]?.[label];
                                            return (
                                                <td
                                                    key={`buy-${label}`}
                                                    className="px-3 py-1.5 text-right font-mono"
                                                >
                                                    {fmtDiv(buyVal ?? 0)}
                                                </td>
                                            );
                                        })}
                                    {hasPrices &&
                                        priceLabels.map((label) => {
                                            const price =
                                                assetPriceByMonth?.[
                                                    row.month
                                                ]?.[label];
                                            const shares = hasShares
                                                ? assetSharesByMonth?.[
                                                      row.month
                                                  ]?.[label]
                                                : undefined;
                                            return (
                                                <td
                                                    key={`price-${label}`}
                                                    className="px-3 py-1.5 text-right font-mono text-muted-foreground"
                                                >
                                                    <span>
                                                        {fmtPrice(price)}
                                                    </span>
                                                    {shares !== undefined && (
                                                        <span className="block text-[10px] text-muted-foreground/70">
                                                            {fmtShares(shares)}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
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
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {(hasPrices || hasPurchases) && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {hasPrices &&
                        '자산별 가격은 월말 종가(분할조정) 기준입니다.'}
                    {hasPrices &&
                        hasShares &&
                        ' 가격 아래 수량(×N주)은 월말 보유 주수입니다.'}
                    {hasPrices &&
                        hasWeights &&
                        ' 비중은 월말 NAV 대비 보유 시가총액 기준입니다.'}
                    {hasPurchases &&
                        ' 매수액은 정기납입·입금·배당 재투자 합계입니다 (초기 일시금·리밸런싱 매매 제외).'}
                </p>
            )}
        </section>
    );
}
