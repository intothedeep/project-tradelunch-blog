// components/backtest/MetricsPanel.tsx
// Purpose: summary statistics from BacktestMetrics.
// Shows CAGR (lump-only) or XIRR (DCA). Always shows totalContributed.
// X2.14: when rebalance present, shows event count, total turnover, warnings.

import type { BacktestMetrics, BacktestResult } from '@/types/backtest';

interface MetricsPanelProps {
    metrics: BacktestMetrics;
    budget: number;
    riskFreeRate: number;
    hasContribution?: boolean;
    /** X2.14 — rebalance audit trail; absent = no rebalance section rendered. */
    rebalance?: BacktestResult['rebalance'];
}

function fmt$(v: number): string {
    return v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    });
}
function fmtPct(v: number, decimals = 1): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`;
}

interface CardProps {
    label: string;
    value: string;
    positive?: boolean;
    negative?: boolean;
}

function Card({ label, value, positive, negative }: CardProps) {
    const color = positive
        ? 'text-green-600 dark:text-green-400'
        : negative
          ? 'text-red-600 dark:text-red-400'
          : '';
    return (
        <div className="flex flex-col gap-0.5 rounded-md border bg-card p-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-lg font-semibold tabular-nums ${color}`}>
                {value}
            </span>
        </div>
    );
}

// ── X2.14: rebalance summary strip ────────────────────────────────────────────

interface RebalanceSummaryProps {
    rebalance: NonNullable<BacktestResult['rebalance']>;
}

function RebalanceSummary({ rebalance }: RebalanceSummaryProps) {
    const events = rebalance.events ?? [];
    const warnings = rebalance.warnings ?? [];

    if (events.length === 0 && warnings.length === 0) return null;

    const totalTurnover = events.reduce((s, e) => s + e.turnover, 0);

    return (
        <div className="rounded-md border bg-muted/30 px-4 py-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-muted-foreground">
                    리밸런싱{' '}
                    <span className="font-semibold text-foreground">
                        {events.length}회
                    </span>
                </span>
                {totalTurnover > 0 && (
                    <span className="text-muted-foreground">
                        총 회전율{' '}
                        <span className="font-semibold text-foreground">
                            {fmtPct(totalTurnover, 1)}
                        </span>
                    </span>
                )}
            </div>
            {warnings.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                    {warnings.map((w, i) => (
                        <li
                            key={i}
                            className="text-[11px] text-amber-600 dark:text-amber-400"
                        >
                            {w}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export default function MetricsPanel({
    metrics,
    riskFreeRate,
    hasContribution,
    rebalance,
}: MetricsPanelProps) {
    const {
        finalValue,
        totalReturnPct,
        cagr,
        maxDrawdown,
        cumulativeDividends,
        sharpe,
        totalContributed,
        moneyWeightedReturn,
    } = metrics;

    const profit = finalValue - totalContributed;

    return (
        <section
            aria-label="Portfolio metrics"
            className="flex flex-col gap-3"
        >
            <h2 className="text-sm font-semibold">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                <Card
                    label="Final Value"
                    value={fmt$(finalValue)}
                    positive={profit > 0}
                    negative={profit < 0}
                />
                <Card
                    label="Total Invested"
                    value={fmt$(totalContributed)}
                />
                <Card
                    label={hasContribution ? 'vs Invested' : 'Total Return'}
                    value={fmtPct(totalReturnPct)}
                    positive={totalReturnPct > 0}
                    negative={totalReturnPct < 0}
                />
                {hasContribution ? (
                    <Card
                        label="Money-Weighted Return (XIRR)"
                        value={
                            moneyWeightedReturn !== null
                                ? fmtPct(moneyWeightedReturn)
                                : '—'
                        }
                        positive={
                            moneyWeightedReturn !== null &&
                            moneyWeightedReturn > 0
                        }
                        negative={
                            moneyWeightedReturn !== null &&
                            moneyWeightedReturn < 0
                        }
                    />
                ) : (
                    <Card
                        label="CAGR"
                        value={fmtPct(cagr)}
                        positive={cagr > 0}
                        negative={cagr < 0}
                    />
                )}
                <Card
                    label="Max Drawdown"
                    value={fmtPct(maxDrawdown)}
                    negative={maxDrawdown < 0}
                />
                <Card
                    label="Dividends Received"
                    value={fmt$(cumulativeDividends)}
                    positive={cumulativeDividends > 0}
                />
                {sharpe !== null && (
                    <Card
                        label={`Sharpe (rf=${(riskFreeRate * 100).toFixed(1)}%)`}
                        value={sharpe.toFixed(2)}
                        positive={sharpe > 1}
                        negative={sharpe < 0}
                    />
                )}
            </div>
            {rebalance && <RebalanceSummary rebalance={rebalance} />}
        </section>
    );
}
