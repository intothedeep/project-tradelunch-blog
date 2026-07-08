'use client';

// components/backtest/ContributionInput.client.tsx
// Purpose: DCA recurring-contribution controls (amount + frequency + none).
// Renders a row of controls that yields a ContributionPlan or undefined.
// Route selector: 'by weight (all)' | 'by DCA weight' | '→ <label>'.

import type {
    ContributionPlan,
    ContributionFreq,
    ContributionRoute,
} from '@/types/backtest';

interface ContributionInputProps {
    value: ContributionPlan | undefined;
    /** Selectable holding labels, for routing all DCA cash to one asset. */
    labels: string[];
    onChange: (plan: ContributionPlan | undefined) => void;
}

const BY_WEIGHT = 'byWeight';
const BY_DCA_WEIGHT = 'byDcaWeight';

function routeToValue(route: ContributionRoute | undefined): string {
    if (!route || route.kind === 'byWeight') return BY_WEIGHT;
    if (route.kind === 'byDcaWeight') return BY_DCA_WEIGHT;
    return route.target;
}

const FREQ_OPTIONS: { value: ContributionFreq; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

export default function ContributionInput({
    value,
    labels,
    onChange,
}: ContributionInputProps) {
    const enabled = value !== undefined;
    const amount = value?.amount ?? 500;
    const freq = value?.freq ?? 'monthly';
    const route = value?.route;

    function handleToggle() {
        onChange(enabled ? undefined : { amount, freq });
    }

    function handleAmount(raw: string) {
        const n = Number(raw);
        if (!isFinite(n) || n <= 0) return;
        onChange({ amount: n, freq, route });
    }

    function handleFreq(f: ContributionFreq) {
        onChange({ amount, freq: f, route });
    }

    function handleRoute(val: string) {
        let nextRoute: ContributionRoute | undefined;
        if (val === BY_WEIGHT) {
            nextRoute = undefined; // byWeight = default → drop field (URL stays clean)
        } else if (val === BY_DCA_WEIGHT) {
            nextRoute = { kind: 'byDcaWeight' };
        } else {
            nextRoute = { kind: 'asset', target: val };
        }
        onChange({ amount, freq, route: nextRoute });
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

                    {labels.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground">
                                into
                            </span>
                            <select
                                value={routeToValue(route)}
                                onChange={(e) => handleRoute(e.target.value)}
                                aria-label="DCA contribution routing"
                                title="Where recurring contributions are invested"
                                className="rounded border bg-background px-1.5 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value={BY_WEIGHT}>
                                    by weight (all)
                                </option>
                                <option value={BY_DCA_WEIGHT}>
                                    by DCA weight
                                </option>
                                {labels.map((l) => (
                                    <option
                                        key={l}
                                        value={l}
                                    >
                                        → {l}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
