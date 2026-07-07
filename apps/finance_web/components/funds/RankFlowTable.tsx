// components/funds/RankFlowTable.tsx
// Purpose: bump-style rank-flow visualization with two view modes.
//   "flow" (default): each column shows securities stacked top→bottom by that
//   quarter's rank — position encodes rank. Click column header → "aligned" mode.
//   "aligned": rows fixed by the reference quarter's rank; other quarters shown
//   in those fixed rows so movement across columns is visible.
// Constraints: "use client" — local state for mode, reference period, active cusip.
//   Stable per-cusip color via cusipColor() — unchanged across modes.
//   Click cell → ring on ALL cells of that cusip (inset, no layout shift).
//   Keyboard: Tab/Enter/Space on cells; Enter/Space on column headers.
//   Horizontal scroll; min column width for small viewports (375px swipeable).
//   Esc clears the reference period and returns to flow mode.
// Side effects: none beyond React state.

'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { quarterLabel } from '@/utils/quarterLabel';
import {
    getOrderedPeriods,
    getCell,
    orderColumnByRank,
    sortRowsByReference,
} from '@/utils/rankFlowRows';
import { deriveCellBadges, type CellBadge } from '@/utils/rankFlowBadges';
import { HoldingCell } from '@/components/funds/HoldingCell';
import { ConsensusPanel } from '@/components/funds/ConsensusPanel.client';
import type { RankFlow, RankFlowPeriod, RankFlowRow } from '@/types/rankFlow';

interface RankFlowTableProps {
    data: RankFlow;
}

// Minimum column width so content never wraps on small viewports.
const COL_MIN_W = 'min-w-[130px]';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GhostCell() {
    return (
        <div className="rounded border border-dashed border-muted-foreground/20 h-[72px] opacity-40" />
    );
}

function AggregateRow({ period }: { period: RankFlowPeriod }) {
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

// ---------------------------------------------------------------------------
// Column header — toggles aligned mode for that quarter
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
    period: string;
    isReference: boolean;
    onClick: (period: string) => void;
}

function ColumnHeader({ period, isReference, onClick }: ColumnHeaderProps) {
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(period);
        }
    }

    return (
        <button
            type="button"
            aria-pressed={isReference}
            aria-current={isReference ? 'true' : undefined}
            onClick={() => onClick(period)}
            onKeyDown={handleKeyDown}
            className={cn(
                'w-full text-center pb-1 border-b cursor-pointer select-none',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                isReference
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/40'
            )}
            title={
                isReference
                    ? 'Reference quarter — click to clear'
                    : 'Set as reference quarter'
            }
        >
            <div
                className={cn(
                    'text-xs font-semibold',
                    isReference ? 'text-primary' : 'text-foreground'
                )}
            >
                {quarterLabel(period)}
            </div>
            <div className="text-[10px] text-muted-foreground">{period}</div>
            {isReference && (
                <div className="text-[9px] text-primary font-medium mt-0.5">
                    ● aligned
                </div>
            )}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Flow column — stacks securities by rank in that quarter (position = rank)
// ---------------------------------------------------------------------------

interface FlowColumnProps {
    period: string;
    periodMeta: RankFlowPeriod | undefined;
    rows: RankFlowRow[];
    activeCusip: string | null;
    isReference: boolean;
    badges: Map<string, Record<string, CellBadge>>;
    onToggleCusip: (cusip: string) => void;
    onHeaderClick: (period: string) => void;
}

function FlowColumn({
    period,
    periodMeta,
    rows,
    activeCusip,
    isReference,
    badges,
    onToggleCusip,
    onHeaderClick,
}: FlowColumnProps) {
    const orderedRows = orderColumnByRank(rows, period);

    return (
        <div className={cn('flex flex-col gap-1 snap-start', COL_MIN_W)}>
            <ColumnHeader
                period={period}
                isReference={isReference}
                onClick={onHeaderClick}
            />
            {orderedRows.map((row) => {
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
                                isActive={activeCusip === row.cusip}
                                isDimmed={
                                    activeCusip !== null &&
                                    activeCusip !== row.cusip
                                }
                                onToggle={onToggleCusip}
                                badge={badges.get(row.cusip)?.[period]}
                            />
                        ) : null}
                    </div>
                );
            })}
            {periodMeta && <AggregateRow period={periodMeta} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Aligned column — rows fixed by reference rank, ghost where not held
// ---------------------------------------------------------------------------

interface AlignedColumnProps {
    period: string;
    periodMeta: RankFlowPeriod | undefined;
    sortedRows: RankFlowRow[];
    activeCusip: string | null;
    isReference: boolean;
    badges: Map<string, Record<string, CellBadge>>;
    onToggleCusip: (cusip: string) => void;
    onHeaderClick: (period: string) => void;
}

function AlignedColumn({
    period,
    periodMeta,
    sortedRows,
    activeCusip,
    isReference,
    badges,
    onToggleCusip,
    onHeaderClick,
}: AlignedColumnProps) {
    return (
        <div className={cn('flex flex-col gap-1 snap-start', COL_MIN_W)}>
            <ColumnHeader
                period={period}
                isReference={isReference}
                onClick={onHeaderClick}
            />
            {sortedRows.map((row) => {
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
                                isActive={activeCusip === row.cusip}
                                isDimmed={
                                    activeCusip !== null &&
                                    activeCusip !== row.cusip
                                }
                                onToggle={onToggleCusip}
                                badge={badges.get(row.cusip)?.[period]}
                            />
                        ) : (
                            <GhostCell />
                        )}
                    </div>
                );
            })}
            {periodMeta && <AggregateRow period={periodMeta} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function RankFlowTable({ data }: RankFlowTableProps) {
    const [activeCusip, setActiveCusip] = useState<string | null>(null);
    const [refPeriod, setRefPeriod] = useState<string | null>(null);

    const isAligned = refPeriod !== null;

    // Esc clears reference → flow mode
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setRefPeriod(null);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const toggleCusip = useCallback((cusip: string) => {
        setActiveCusip((prev) => (prev === cusip ? null : cusip));
    }, []);

    const handleHeaderClick = useCallback((period: string) => {
        // Toggle: clicking the active reference clears it (back to flow)
        setRefPeriod((prev) => (prev === period ? null : period));
    }, []);

    const clearRef = useCallback(() => {
        setRefPeriod(null);
    }, []);

    const orderedPeriods = getOrderedPeriods(data.periods);
    const periodMap = new Map(data.periods.map((p) => [p.periodOfReport, p]));

    // Per-cusip Δ badges (NEW / rank move), computed once against the ordered
    // (newest-first) period keys. Passed down so each cell renders its own.
    const badgesByCusip = new Map(
        data.rows.map((r) => [r.cusip, deriveCellBadges(r, orderedPeriods)])
    );

    if (orderedPeriods.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4">
                No quarters available.
            </p>
        );
    }

    // Sorted rows for aligned mode (stable across renders given same refPeriod)
    const sortedRows = isAligned
        ? sortRowsByReference(data.rows, refPeriod)
        : data.rows;

    return (
        <div>
            {/* Mode indicator + reset button */}
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground">
                    {isAligned ? (
                        <>
                            <span className="font-semibold text-primary">
                                Aligned
                            </span>{' '}
                            — rows sorted by{' '}
                            <span className="font-medium">
                                {quarterLabel(refPeriod)}
                            </span>
                        </>
                    ) : (
                        <span>
                            <span className="font-semibold">Flow</span> —
                            position encodes rank. Click a column header to
                            align.
                        </span>
                    )}
                </span>
                {isAligned && (
                    <button
                        type="button"
                        onClick={clearRef}
                        className={cn(
                            'text-xs px-2 py-0.5 rounded border border-border',
                            'hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'text-muted-foreground transition-colors'
                        )}
                        title="Return to flow mode (also: Esc)"
                    >
                        Reset ↺
                    </button>
                )}
            </div>

            {/* Scrollable columns — snap per quarter for mobile swipe.
                px/py-2 gutter keeps the selected cell's ring-4 + ring-offset-2
                (~6px) from being clipped by overflow-x's implied vertical clip on
                edge columns / the top row; -mx-2 cancels px-2 so edges stay flush. */}
            <div className="overflow-x-auto -mx-2 snap-x snap-mandatory">
                <div
                    className="inline-flex gap-2 px-2 py-2"
                    style={{ minWidth: 'max-content' }}
                >
                    {isAligned
                        ? orderedPeriods.map((period) => (
                              <AlignedColumn
                                  key={period}
                                  period={period}
                                  periodMeta={periodMap.get(period)}
                                  sortedRows={sortedRows}
                                  activeCusip={activeCusip}
                                  isReference={period === refPeriod}
                                  badges={badgesByCusip}
                                  onToggleCusip={toggleCusip}
                                  onHeaderClick={handleHeaderClick}
                              />
                          ))
                        : orderedPeriods.map((period) => (
                              <FlowColumn
                                  key={period}
                                  period={period}
                                  periodMeta={periodMap.get(period)}
                                  rows={data.rows}
                                  activeCusip={activeCusip}
                                  isReference={false}
                                  badges={badgesByCusip}
                                  onToggleCusip={toggleCusip}
                                  onHeaderClick={handleHeaderClick}
                              />
                          ))}
                </div>
            </div>

            {/* Cross-fund consensus for the selected security (lazy). */}
            <ConsensusPanel cusip={activeCusip} />
        </div>
    );
}
