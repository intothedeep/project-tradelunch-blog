// components/backtest/MetricsPanel.tsx
// Purpose: 5-6 summary statistics from BacktestMetrics.
// Stat cards: finalValue, totalReturnPct, cagr, maxDrawdown,
//             cumulativeDividends, sharpe (when not null).

import type { BacktestMetrics } from '@/types/backtest';

interface MetricsPanelProps {
    metrics: BacktestMetrics;
    budget: number;
    riskFreeRate: number;
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

export default function MetricsPanel({
    metrics,
    budget,
    riskFreeRate,
}: MetricsPanelProps) {
    const {
        finalValue,
        totalReturnPct,
        cagr,
        maxDrawdown,
        cumulativeDividends,
        sharpe,
    } = metrics;

    const profit = finalValue - budget;

    return (
        <section aria-label="Portfolio metrics">
            <h2 className="text-sm font-semibold mb-2">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Card
                    label="Final Value"
                    value={fmt$(finalValue)}
                    positive={profit > 0}
                    negative={profit < 0}
                />
                <Card
                    label="Total Return"
                    value={fmtPct(totalReturnPct)}
                    positive={totalReturnPct > 0}
                    negative={totalReturnPct < 0}
                />
                <Card
                    label="CAGR"
                    value={fmtPct(cagr)}
                    positive={cagr > 0}
                    negative={cagr < 0}
                />
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
        </section>
    );
}
