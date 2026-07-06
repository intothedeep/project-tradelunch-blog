// components/backtest/DripToggle.tsx
// Purpose: per-asset DRIP (dividend reinvestment) toggle.
// Default is OFF (cash payout). When ON, dividends buy fractional shares
// at that day's close price (engine handles the math).

import { cn } from '@/lib/utils';

interface DripToggleProps {
    label: string;
    enabled: boolean;
    onChange: (label: string, enabled: boolean) => void;
}

export default function DripToggle({
    label,
    enabled,
    onChange,
}: DripToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(label, !enabled)}
            title={
                enabled
                    ? 'DRIP on — dividends reinvested'
                    : 'DRIP off — cash payout'
            }
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono transition-colors',
                enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-muted text-muted-foreground'
            )}
        >
            DRIP {enabled ? 'ON' : 'OFF'}
        </button>
    );
}
