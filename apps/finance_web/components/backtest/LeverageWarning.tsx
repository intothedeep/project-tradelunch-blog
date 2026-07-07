// components/backtest/LeverageWarning.tsx
// Purpose: visible banner when any selected asset has daily-rebalance leverage.
// Daily compounding causes volatility decay that makes long-horizon CAGR
// extrapolation misleading for leveraged ETFs (TQQQ, QLD, SOXL).

interface LeverageWarningProps {
    labels: string[];
}

export default function LeverageWarning({ labels }: LeverageWarningProps) {
    if (labels.length === 0) return null;

    return (
        <div
            role="alert"
            className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300"
        >
            <strong>Leveraged ETF Warning:</strong> {labels.join(', ')} use
            {labels.length === 1 ? 's' : ''} daily-rebalance leverage.
            Volatility decay (beta-slippage) causes long-horizon CAGR to diverge
            significantly from a simple 2× or 3× multiple of the underlying
            index. Projections shown here compound historical volatility forward
            — treat them as illustrative only.
        </div>
    );
}
