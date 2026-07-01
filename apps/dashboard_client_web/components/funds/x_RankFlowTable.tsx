// components/funds/RankFlowTable.tsx
// Purpose: interactive rank-flow grid — columns=quarters (newest-left),
//   rows=securities, cells show rank+weight. Click a security to track it
//   across all columns with an inset ring (no layout shift).
// Constraints: "use client" — requires useState for active CUSIP selection.
//   Keyboard: Tab/Enter/Space; aria-pressed per cell.
//   Horizontal scroll on narrow viewports; columns never wrap.
// Side effects: none beyond React state.

'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { cusipColor, cusipTextColor } from '@/utils/cusipColor';
import { quarterLabel } from '@/utils/quarterLabel';
import { getOrderedPeriods, getCell } from '@/utils/rankFlowRows';
import { formatUsd } from '@/utils/formatUsd';
import type { RankFlow, RankFlowPeriod } from '@/types/rankFlow';

interface RankFlowTableProps {
    data: RankFlow;
}

// Minimum column width so content never wraps on small viewports.
const COL_MIN_W = 'min-w-[120px]';

interface CellProps {
    cusip: string;
    label: string;
    rank: number;
    weightPct: number;
    valueUsd: number;
    isActive: boolean;
    onToggle: (cusip: string) => void;
}

function HoldingCell({
    cusip,
    label,
    rank,
    weightPct,
    valueUsd,
    isActive,
    onToggle,
}: CellProps) {
    const bg = cusipColor(cusip);
    const textColor = cusipTextColor(cusip);

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(cusip);
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => onToggle(cusip)}
            onKeyDown={handleKeyDown}
            className={cn(
                'relative rounded p-1.5 cursor-pointer select-none transition-shadow',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring',
                isActive && 'ring-2 ring-inset ring-white/80'
            )}
            style={{ backgroundColor: bg, color: textColor }}
            title={`${label} (${cusip})`}
        >
            <div className="text-[10px] font-bold leading-tight">#{rank}</div>
            <div
                className="text-[10px] leading-tight truncate max-w-[100px]"
                title={label}
            >
                {label}
            </div>
            <div className="text-[11px] font-semibold tabular-nums">
                {weightPct.toFixed(1)}%
            </div>
            <div className="text-[9px] opacity-80 tabular-nums">
                {formatUsd(valueUsd)}
            </div>
        </div>
    );
}

function GhostCell() {
    return (
        <div className="rounded border border-dashed border-muted-foreground/20 h-[68px] opacity-40" />
    );
}

interface AggRowProps {
    period: RankFlowPeriod;
}

function AggregateRow({ period }: AggRowProps) {
    if (period.remainingCount === 0) return null;
    return (
        <div className="mt-1 rounded bg-muted/40 px-1.5 py-1 text-center">
            <div className="text-[9px] text-muted-foreground leading-tight">
                +{period.remainingCount} more
            </div>
            <div className="text-[10px] tabular-nums text-muted-foreground">
                Σ{period.remainingWeightPct.toFixed(1)}%
            </div>
        </div>
    );
}

export default function RankFlowTable({ data }: RankFlowTableProps) {
    const [activeCusip, setActiveCusip] = useState<string | null>(null);

    const toggleCusip = useCallback((cusip: string) => {
        setActiveCusip((prev) => (prev === cusip ? null : cusip));
    }, []);

    const orderedPeriods = getOrderedPeriods(data.periods);
    const periodMap = new Map(data.periods.map((p) => [p.periodOfReport, p]));

    if (orderedPeriods.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4">
                No quarters available.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto -mx-1">
            <div
                className="inline-flex gap-2 px-1 pb-2"
                style={{ minWidth: 'max-content' }}
            >
                {orderedPeriods.map((period) => {
                    const periodMeta = periodMap.get(period);

                    return (
                        <div
                            key={period}
                            className={cn('flex flex-col gap-1', COL_MIN_W)}
                        >
                            {/* Column header */}
                            <div className="text-center pb-1 border-b border-border">
                                <div className="text-xs font-semibold text-foreground">
                                    {quarterLabel(period)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {period}
                                </div>
                            </div>

                            {/* Row cells */}
                            {data.rows.map((row) => {
                                const cell = getCell(row, period);
                                return (
                                    <div key={row.cusip}>
                                        {cell !== null ? (
                                            <HoldingCell
                                                cusip={row.cusip}
                                                label={row.label}
                                                rank={cell.rank}
                                                weightPct={cell.weightPct}
                                                valueUsd={cell.valueUsd}
                                                isActive={
                                                    activeCusip === row.cusip
                                                }
                                                onToggle={toggleCusip}
                                            />
                                        ) : (
                                            <GhostCell />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Aggregate trailing row */}
                            {periodMeta && <AggregateRow period={periodMeta} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
