// components/backtest/IncomeProjection.tsx
// Purpose: yield-based income projection from the backtest result.
// Shows annualised yield %, projected annual and monthly dividend cash —
// particularly relevant for high-distribution ETFs like JEPQ, SCHD, TLT.

import type { ProjectionResult } from '@/types/backtest';

interface IncomeProjectionProps {
    income: ProjectionResult['income'];
    budget: number;
}

function fmt$(v: number, decimals = 0): string {
    return v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export default function IncomeProjection({
    income,
    budget,
}: IncomeProjectionProps) {
    const { annualYieldPct, projectedAnnualCash, projectedMonthlyCash } =
        income;

    const hasIncome = projectedAnnualCash > 0.01;

    return (
        <section aria-label="Income projection">
            <h2 className="text-sm font-semibold mb-2">Income Projection</h2>
            {!hasIncome ? (
                <p className="text-sm text-muted-foreground">
                    No dividend income observed in this period.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-md border bg-card p-3">
                        <p className="text-xs text-muted-foreground">
                            Annualised Yield
                        </p>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {(annualYieldPct * 100).toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            on {fmt$(budget, 0)} investment
                        </p>
                    </div>
                    <div className="rounded-md border bg-card p-3">
                        <p className="text-xs text-muted-foreground">
                            Projected Annual Income
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                            {fmt$(projectedAnnualCash, 2)}
                        </p>
                    </div>
                    <div className="rounded-md border bg-card p-3">
                        <p className="text-xs text-muted-foreground">
                            Projected Monthly Income
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                            {fmt$(projectedMonthlyCash, 2)}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}
