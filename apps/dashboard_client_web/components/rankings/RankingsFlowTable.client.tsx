// components/rankings/RankingsFlowTable.client.tsx
// Purpose: bump-style rank-flow visualization for market_rankings (symbol-keyed).
//   "flow" (default): each column stacks symbols top→bottom by that period's rank.
//   "aligned": rows fixed by the reference period's rank; click column header to set.
//   Mirrors the shape of components/funds/RankFlowTable.tsx but uses symbol as key.
// Constraints: "use client"; local state for mode, reference period, active symbol.
//   Stable per-symbol color via symbolColor(). Esc clears reference → flow mode.
//   Horizontal scroll; min column width for small viewports.
// Side effects: none beyond React state.

'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    getOrderedAsOfs,
    orderFlowColumnByRank,
    sortFlowRowsByRef,
    periodLabel,
} from '@/utils/rankFlowRows';
import type {
    RankingsFlow,
    RankingsFlowRow,
    RankingsFlowCell,
} from '@/types/rankingsFlow';

interface RankingsFlowTableProps {
    data: RankingsFlow;
}

const COL_MIN_W = 'min-w-[110px]';

// Deterministic color from a symbol string (same color every render).
function symbolColor(symbol: string): string {
    let h = 0;
    for (let i = 0; i < symbol.length; i++) {
        h = (h * 31 + symbol.charCodeAt(i)) & 0xffff;
    }
    return `hsl(${h % 360}, 60%, 48%)`;
}

function formatMarketCap(v: number | null): string {
    if (v === null) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GhostCell() {
    return (
        <div className="rounded border border-dashed border-muted-foreground/20 h-[64px] opacity-40" />
    );
}

interface SymbolCellProps {
    row: RankingsFlowRow;
    cell: RankingsFlowCell;
    isActive: boolean;
    isDimmed: boolean;
    onToggle: (symbol: string) => void;
}

function SymbolCell({
    row,
    cell,
    isActive,
    isDimmed,
    onToggle,
}: SymbolCellProps) {
    const color = symbolColor(row.symbol);
    return (
        <button
            type="button"
            onClick={() => onToggle(row.symbol)}
            aria-pressed={isActive}
            className={cn(
                'w-full rounded border px-1.5 py-1 text-left transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'h-[64px] flex flex-col justify-between',
                isActive
                    ? 'ring-2 ring-offset-1 border-transparent'
                    : 'border-border hover:border-muted-foreground/50',
                isDimmed && 'opacity-30'
            )}
            style={isActive ? { borderColor: color } : undefined}
        >
            <div
                className="text-xs font-mono font-bold leading-none truncate"
                style={{ color }}
            >
                {row.symbol}
            </div>
            <div className="text-[9px] text-muted-foreground leading-none">
                #{cell.rank}
            </div>
            <div className="text-[10px] tabular-nums text-foreground leading-none">
                {formatMarketCap(cell.marketCap)}
            </div>
        </button>
    );
}

interface ColumnHeaderProps {
    asOf: string;
    granularity: string;
    isReference: boolean;
    onClick: (asOf: string) => void;
}

function ColumnHeader({
    asOf,
    granularity,
    isReference,
    onClick,
}: ColumnHeaderProps) {
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(asOf);
        }
    }
    return (
        <button
            type="button"
            aria-pressed={isReference}
            onClick={() => onClick(asOf)}
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
                    ? 'Reference period — click to clear'
                    : 'Set as reference period'
            }
        >
            <div
                className={cn(
                    'text-xs font-semibold',
                    isReference ? 'text-primary' : 'text-foreground'
                )}
            >
                {periodLabel(asOf, granularity)}
            </div>
            <div className="text-[10px] text-muted-foreground">{asOf}</div>
            {isReference && (
                <div className="text-[9px] text-primary font-medium mt-0.5">
                    ● aligned
                </div>
            )}
        </button>
    );
}

interface FlowColumnProps {
    asOf: string;
    granularity: string;
    rows: RankingsFlowRow[];
    activeSymbol: string | null;
    isReference: boolean;
    onToggleSymbol: (s: string) => void;
    onHeaderClick: (asOf: string) => void;
}

function FlowColumn({
    asOf,
    granularity,
    rows,
    activeSymbol,
    isReference,
    onToggleSymbol,
    onHeaderClick,
}: FlowColumnProps) {
    const ordered = orderFlowColumnByRank(rows, asOf);
    return (
        <div className={cn('flex flex-col gap-1 snap-start', COL_MIN_W)}>
            <ColumnHeader
                asOf={asOf}
                granularity={granularity}
                isReference={isReference}
                onClick={onHeaderClick}
            />
            {ordered.map((row) => {
                const cell = row.cells[asOf] ?? null;
                return cell ? (
                    <SymbolCell
                        key={row.symbol}
                        row={row}
                        cell={cell}
                        isActive={activeSymbol === row.symbol}
                        isDimmed={
                            activeSymbol !== null && activeSymbol !== row.symbol
                        }
                        onToggle={onToggleSymbol}
                    />
                ) : null;
            })}
        </div>
    );
}

interface AlignedColumnProps {
    asOf: string;
    granularity: string;
    sortedRows: RankingsFlowRow[];
    activeSymbol: string | null;
    isReference: boolean;
    onToggleSymbol: (s: string) => void;
    onHeaderClick: (asOf: string) => void;
}

function AlignedColumn({
    asOf,
    granularity,
    sortedRows,
    activeSymbol,
    isReference,
    onToggleSymbol,
    onHeaderClick,
}: AlignedColumnProps) {
    return (
        <div className={cn('flex flex-col gap-1 snap-start', COL_MIN_W)}>
            <ColumnHeader
                asOf={asOf}
                granularity={granularity}
                isReference={isReference}
                onClick={onHeaderClick}
            />
            {sortedRows.map((row) => {
                const cell = row.cells[asOf] ?? null;
                return (
                    <div key={row.symbol}>
                        {cell ? (
                            <SymbolCell
                                row={row}
                                cell={cell}
                                isActive={activeSymbol === row.symbol}
                                isDimmed={
                                    activeSymbol !== null &&
                                    activeSymbol !== row.symbol
                                }
                                onToggle={onToggleSymbol}
                            />
                        ) : (
                            <GhostCell />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function RankingsFlowTable({ data }: RankingsFlowTableProps) {
    const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
    const [refPeriod, setRefPeriod] = useState<string | null>(null);

    const isAligned = refPeriod !== null;

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setRefPeriod(null);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const toggleSymbol = useCallback((s: string) => {
        setActiveSymbol((prev) => (prev === s ? null : s));
    }, []);

    const handleHeaderClick = useCallback((asOf: string) => {
        setRefPeriod((prev) => (prev === asOf ? null : asOf));
    }, []);

    const clearRef = useCallback(() => setRefPeriod(null), []);

    const orderedAsOfs = getOrderedAsOfs(data.periods);
    const sortedRows = isAligned
        ? sortFlowRowsByRef(data.rows, refPeriod, (a, b) =>
              a.symbol.localeCompare(b.symbol)
          )
        : data.rows;

    if (orderedAsOfs.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4">
                No periods available.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground">
                    {isAligned ? (
                        <>
                            <span className="font-semibold text-primary">
                                Aligned
                            </span>{' '}
                            — rows sorted by{' '}
                            <span className="font-medium">
                                {periodLabel(refPeriod!, data.granularity)}
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

            <div className="overflow-x-auto -mx-2 snap-x snap-mandatory">
                <div
                    className="inline-flex gap-2 px-2 py-2"
                    style={{ minWidth: 'max-content' }}
                >
                    {isAligned
                        ? orderedAsOfs.map((asOf) => (
                              <AlignedColumn
                                  key={asOf}
                                  asOf={asOf}
                                  granularity={data.granularity}
                                  sortedRows={sortedRows}
                                  activeSymbol={activeSymbol}
                                  isReference={asOf === refPeriod}
                                  onToggleSymbol={toggleSymbol}
                                  onHeaderClick={handleHeaderClick}
                              />
                          ))
                        : orderedAsOfs.map((asOf) => (
                              <FlowColumn
                                  key={asOf}
                                  asOf={asOf}
                                  granularity={data.granularity}
                                  rows={data.rows}
                                  activeSymbol={activeSymbol}
                                  isReference={false}
                                  onToggleSymbol={toggleSymbol}
                                  onHeaderClick={handleHeaderClick}
                              />
                          ))}
                </div>
            </div>
        </div>
    );
}
