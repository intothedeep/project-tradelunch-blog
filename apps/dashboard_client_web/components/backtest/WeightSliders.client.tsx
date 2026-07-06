'use client';

// components/backtest/WeightSliders.client.tsx
// Purpose: per-asset weight % sliders. Weights must sum to 100.
// Shows running total, "equal split" button, and disables run when invalid.
// Remainder is assigned to the first asset on equal split.

import { cn } from '@/lib/utils';
import type { Holding } from '@/types/backtest';
import DripToggle from './DripToggle';

interface WeightSlidersProps {
    holdings: Holding[];
    onChange: (holdings: Holding[]) => void;
}

export default function WeightSliders({
    holdings,
    onChange,
}: WeightSlidersProps) {
    const total = holdings.reduce((s, h) => s + h.weightPct, 0);
    const isValid = Math.round(total) === 100;

    function updateWeight(label: string, weightPct: number) {
        onChange(
            holdings.map((h) => (h.label === label ? { ...h, weightPct } : h))
        );
    }

    function updateDrip(label: string, drip: boolean) {
        onChange(holdings.map((h) => (h.label === label ? { ...h, drip } : h)));
    }

    function equalSplit() {
        if (holdings.length === 0) return;
        const base = Math.floor(100 / holdings.length);
        const remainder = 100 - base * holdings.length;
        onChange(
            holdings.map((h, i) => ({
                ...h,
                weightPct: i === 0 ? base + remainder : base,
            }))
        );
    }

    if (holdings.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Select at least one asset.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Weights</span>
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'text-sm tabular-nums font-semibold',
                            isValid
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-destructive'
                        )}
                    >
                        {total.toFixed(1)}% / 100%
                    </span>
                    <button
                        type="button"
                        onClick={equalSplit}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                    >
                        Equal split
                    </button>
                </div>
            </div>

            {holdings.map((h) => (
                <div
                    key={h.label}
                    className="flex flex-col gap-1"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold">
                            {h.label}
                        </span>
                        <div className="flex items-center gap-2">
                            <DripToggle
                                label={h.label}
                                enabled={h.drip}
                                onChange={updateDrip}
                            />
                            <span className="text-xs tabular-nums w-10 text-right">
                                {h.weightPct}%
                            </span>
                        </div>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={99}
                        step={1}
                        value={h.weightPct}
                        onChange={(e) =>
                            updateWeight(h.label, Number(e.target.value))
                        }
                        className="w-full accent-primary"
                        aria-label={`${h.label} weight`}
                    />
                </div>
            ))}

            {!isValid && (
                <p className="text-xs text-destructive">
                    Total must equal 100%. Currently {total.toFixed(1)}%.
                </p>
            )}
        </div>
    );
}
