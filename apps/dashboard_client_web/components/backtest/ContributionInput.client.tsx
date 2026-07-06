'use client';

// components/backtest/ContributionInput.client.tsx
// Purpose: DCA recurring-contribution controls (amount + frequency + none).
// Renders a row of controls that yields a ContributionPlan or undefined.

import type { ContributionPlan, ContributionFreq } from '@/types/backtest';

interface ContributionInputProps {
    value: ContributionPlan | undefined;
    onChange: (plan: ContributionPlan | undefined) => void;
}

const FREQ_OPTIONS: { value: ContributionFreq; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

export default function ContributionInput({
    value,
    onChange,
}: ContributionInputProps) {
    const enabled = value !== undefined;
    const amount = value?.amount ?? 500;
    const freq = value?.freq ?? 'monthly';

    function handleToggle() {
        onChange(enabled ? undefined : { amount, freq });
    }

    function handleAmount(raw: string) {
        const n = Number(raw);
        if (!isFinite(n) || n <= 0) return;
        onChange({ amount: n, freq });
    }

    function handleFreq(f: ContributionFreq) {
        onChange({ amount, freq: f });
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    id="contribution-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={handleToggle}
                    className="h-4 w-4 cursor-pointer"
                />
                <label
                    htmlFor="contribution-toggle"
                    className="text-sm font-medium cursor-pointer select-none"
                >
                    Recurring Contribution (DCA)
                </label>
            </div>

            {enabled && (
                <div className="flex flex-wrap items-center gap-3 pl-6">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                            type="number"
                            min={1}
                            step={100}
                            defaultValue={amount}
                            onBlur={(e) => handleAmount(e.target.value)}
                            className="w-28 rounded border bg-background px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label="Contribution amount"
                        />
                        <span className="text-sm text-muted-foreground">
                            per period
                        </span>
                    </div>

                    <div
                        className="flex gap-1.5"
                        role="group"
                        aria-label="Frequency"
                    >
                        {FREQ_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleFreq(opt.value)}
                                className={
                                    freq === opt.value
                                        ? 'rounded px-3 py-1 text-sm font-medium bg-primary text-primary-foreground'
                                        : 'rounded px-3 py-1 text-sm font-medium border hover:bg-muted'
                                }
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
