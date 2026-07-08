'use client';

// components/backtest/PerSourceWeights.client.tsx
// Purpose: three-column per-asset weight grid for Original / DCA / Dividend sources.
// - Original %: read-only mirror of weightPct (owned by WeightSliders).
// - DCA %: disabled when dcaActive is false; blank → fallback to weightPct.
// - Div %: disabled when divActive is false; blank → fallback to weightPct.
// Per-column running-sum hint (green when > 0, muted otherwise). No forced 100.
// A header checkbox activates dividendReinvestByWeight (divActive flag).

import { cn } from '@/lib/utils';
import type { Holding } from '@/types/backtest';

interface PerSourceWeightsProps {
    holdings: Holding[];
    /** True when a DCA contribution plan is active (enables DCA % column). */
    dcaActive: boolean;
    /** True when dividendReinvestByWeight is enabled (enables Div % column). */
    divActive: boolean;
    onUpdateHolding: (label: string, patch: Partial<Holding>) => void;
    onToggleDiv: (active: boolean) => void;
}

function colSum(holdings: Holding[], field: 'dcaPct' | 'divPct'): number {
    return holdings.reduce((s, h) => {
        const v = h[field];
        return s + (v !== undefined ? v : h.weightPct);
    }, 0);
}

function NumberInput({
    value,
    placeholder,
    disabled,
    onChange,
    ariaLabel,
}: {
    value: number | undefined;
    placeholder: string;
    disabled: boolean;
    onChange: (v: number | undefined) => void;
    ariaLabel: string;
}) {
    return (
        <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={value !== undefined ? value : ''}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                    onChange(undefined);
                } else {
                    const n = Number(raw);
                    if (isFinite(n)) onChange(n);
                }
            }}
            className={cn(
                'w-16 rounded border bg-background px-1.5 py-0.5 text-xs tabular-nums',
                'focus:outline-none focus:ring-1 focus:ring-ring text-right',
                disabled && 'opacity-40 cursor-not-allowed'
            )}
        />
    );
}

function SumHint({ sum, active }: { sum: number; active: boolean }) {
    return (
        <span
            className={cn(
                'text-xs tabular-nums font-semibold',
                active && sum > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground'
            )}
        >
            Σ {sum.toFixed(1)}%
        </span>
    );
}

export default function PerSourceWeights({
    holdings,
    dcaActive,
    divActive,
    onUpdateHolding,
    onToggleDiv,
}: PerSourceWeightsProps) {
    if (holdings.length === 0) return null;

    const origSum = holdings.reduce((s, h) => s + h.weightPct, 0);
    const dcaSum = colSum(holdings, 'dcaPct');
    const divSum = colSum(holdings, 'divPct');

    return (
        <div className="flex flex-col gap-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Per-Source Weights
                </span>
                <span className="text-xs font-medium text-muted-foreground w-16 text-right">
                    Original
                </span>
                <span
                    className={cn(
                        'text-xs font-medium w-16 text-right',
                        dcaActive
                            ? 'text-foreground'
                            : 'text-muted-foreground opacity-50'
                    )}
                >
                    DCA %
                </span>
                {/* Div % header with checkbox toggle */}
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={divActive}
                        onChange={(e) => onToggleDiv(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer"
                        aria-label="Enable dividend reinvest by weight"
                    />
                    <span
                        className={cn(
                            'text-xs font-medium w-14 text-right',
                            divActive
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                        )}
                    >
                        Div %
                    </span>
                </label>
            </div>

            {/* Per-holding rows */}
            {holdings.map((h) => (
                <div
                    key={h.label}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center"
                >
                    <span className="text-xs font-mono font-semibold">
                        {h.label}
                    </span>
                    {/* Original % — read-only */}
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                        {h.weightPct}%
                    </span>
                    {/* DCA % */}
                    <NumberInput
                        value={h.dcaPct}
                        placeholder={String(h.weightPct)}
                        disabled={!dcaActive}
                        ariaLabel={`${h.label} DCA weight`}
                        onChange={(v) =>
                            onUpdateHolding(h.label, { dcaPct: v })
                        }
                    />
                    {/* Div % */}
                    <NumberInput
                        value={h.divPct}
                        placeholder={String(h.weightPct)}
                        disabled={!divActive}
                        ariaLabel={`${h.label} dividend reinvest weight`}
                        onChange={(v) =>
                            onUpdateHolding(h.label, { divPct: v })
                        }
                    />
                </div>
            ))}

            {/* Column sum hints */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center border-t border-border pt-1">
                <span />
                <SumHint
                    sum={origSum}
                    active={true}
                />
                <SumHint
                    sum={dcaSum}
                    active={dcaActive}
                />
                <SumHint
                    sum={divSum}
                    active={divActive}
                />
            </div>
        </div>
    );
}
