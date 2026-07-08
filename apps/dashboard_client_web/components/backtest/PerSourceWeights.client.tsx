'use client';

// components/backtest/PerSourceWeights.client.tsx
// Purpose: unified per-asset weight grid — Original (editable + DRIP) / DCA / Div.
// - Original %: editable number input bound to holding.weightPct.
// - DividendRouteSelect: DRIP dropdown in the Original cell.
// - DCA %: disabled when dcaActive is false; blank → fallback to weightPct.
// - Div %: disabled when divActive is false; blank → fallback to weightPct.
// Per-column running-sum hints. A header checkbox activates divActive flag.

import { cn } from '@/lib/utils';
import type { DividendRoute, Holding } from '@/types/backtest';
import { resolveRoute } from '@/utils/backtest/dividends';
import DividendRouteSelect from './DividendRouteSelect.client';

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

// ── Per-row sub-component ─────────────────────────────────────────────────────

interface PerSourceWeightRowProps {
    holding: Holding;
    otherHoldings: Holding[];
    dcaActive: boolean;
    divActive: boolean;
    onUpdateHolding: (label: string, patch: Partial<Holding>) => void;
}

function PerSourceWeightRow({
    holding: h,
    otherHoldings,
    dcaActive,
    divActive,
    onUpdateHolding,
}: PerSourceWeightRowProps) {
    function handleRouteChange(label: string, route: DividendRoute) {
        onUpdateHolding(label, { dividendRoute: route });
    }

    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
            <span className="text-xs font-mono font-semibold">{h.label}</span>

            {/* Original % — editable + DRIP dropdown */}
            <div className="flex items-center gap-1">
                <NumberInput
                    value={h.weightPct}
                    placeholder="0"
                    disabled={false}
                    ariaLabel={`${h.label} original weight`}
                    onChange={(v) =>
                        onUpdateHolding(h.label, {
                            weightPct: v !== undefined ? v : 0,
                        })
                    }
                />
                <DividendRouteSelect
                    label={h.label}
                    route={resolveRoute(h)}
                    otherHoldings={otherHoldings}
                    onChange={handleRouteChange}
                />
            </div>

            {/* DCA % */}
            <NumberInput
                value={h.dcaPct}
                placeholder={String(h.weightPct)}
                disabled={!dcaActive}
                ariaLabel={`${h.label} DCA weight`}
                onChange={(v) => onUpdateHolding(h.label, { dcaPct: v })}
            />

            {/* Div % */}
            <NumberInput
                value={h.divPct}
                placeholder={String(h.weightPct)}
                disabled={!divActive}
                ariaLabel={`${h.label} dividend reinvest weight`}
                onChange={(v) => onUpdateHolding(h.label, { divPct: v })}
            />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PerSourceWeights({
    holdings,
    dcaActive,
    divActive,
    onUpdateHolding,
    onToggleDiv,
}: PerSourceWeightsProps) {
    if (holdings.length === 0) return null;

    const origSum = holdings.reduce((s, h) => s + h.weightPct, 0);
    const origValid = Math.round(origSum) === 100;
    const dcaSum = colSum(holdings, 'dcaPct');
    const divSum = colSum(holdings, 'divPct');

    return (
        <div className="flex flex-col gap-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    자산
                </span>
                <span className="text-xs font-medium text-muted-foreground text-right">
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
                <PerSourceWeightRow
                    key={h.label}
                    holding={h}
                    otherHoldings={holdings.filter((x) => x.label !== h.label)}
                    dcaActive={dcaActive}
                    divActive={divActive}
                    onUpdateHolding={onUpdateHolding}
                />
            ))}

            {/* Column sum hints */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center border-t border-border pt-1">
                <span />
                {/* Original sum — green when ==100, red/amber otherwise */}
                <span
                    className={cn(
                        'text-xs tabular-nums font-semibold',
                        origValid
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-destructive'
                    )}
                >
                    Σ {origSum.toFixed(1)}%
                </span>
                <SumHint
                    sum={dcaSum}
                    active={dcaActive}
                />
                <SumHint
                    sum={divSum}
                    active={divActive}
                />
            </div>

            {/* Original weight gate warning */}
            {!origValid && (
                <p className="text-xs text-destructive">
                    Original 합계가 100%여야 합니다. 현재 {origSum.toFixed(1)}%.
                </p>
            )}
        </div>
    );
}
