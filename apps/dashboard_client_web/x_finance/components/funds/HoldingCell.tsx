// components/funds/HoldingCell.tsx
// Purpose: one rank-flow cell — cusip-colored tile showing rank / label /
//   weight / value, plus optional quarter-over-quarter badges (P7-3).
// Constraints: color is NOT load-bearing — badges always carry a text symbol
//   (NEW / ▲ / ▼) on a neutral chip so they read on any cusip hue and for
//   colorblind users. Extracted from RankFlowTable to keep that file ≤300 LOC.
// Side effects: none beyond the onToggle callback.

'use client';

import { cn } from '@/lib/utils';
import { cusipColor, cusipTextColor } from '@/utils/cusipColor';
import { formatUsd } from '@/utils/formatUsd';
import type { CellBadge } from '@/utils/rankFlowBadges';

export interface HoldingCellProps {
    cusip: string;
    label: string;
    rank: number;
    weightPct: number;
    valueUsd: number;
    isActive: boolean;
    // Something else is selected and this is not it → fade to spotlight the
    // active cusip's trail. Keeps each tile's own hue (and its paired text
    // color) intact, so legibility never depends on the selection state.
    isDimmed?: boolean;
    onToggle: (cusip: string) => void;
    badge?: CellBadge;
}

// Compact Δ badges: NEW (added this quarter) + rank move ▲/▼. Rendered on a
// neutral translucent chip so they stay legible over the cusip color.
function CellBadges({ badge }: { badge: CellBadge }) {
    const rankDelta = badge.rankDelta;
    const showRank = rankDelta !== null && rankDelta !== 0;
    if (!badge.isNew && !showRank) return null;
    return (
        <div className="mt-0.5 flex flex-wrap gap-0.5">
            {badge.isNew && (
                <span className="rounded-sm bg-black/25 px-1 text-[8px] font-bold leading-tight">
                    NEW
                </span>
            )}
            {showRank && (
                <span
                    className="rounded-sm bg-black/25 px-1 text-[8px] font-semibold leading-tight tabular-nums"
                    title={`rank ${rankDelta! > 0 ? 'up' : 'down'} ${Math.abs(rankDelta!)}`}
                >
                    {rankDelta! > 0 ? '▲' : '▼'}
                    {Math.abs(rankDelta!)}
                </span>
            )}
        </div>
    );
}

export function HoldingCell({
    cusip,
    label,
    rank,
    weightPct,
    valueUsd,
    isActive,
    isDimmed = false,
    onToggle,
    badge,
}: HoldingCellProps) {
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
                // transition-opacity (NOT transition-all): a large grid (funds
                // with many holdings × quarters = hundreds of cells) animating
                // every property — including the CSS filter below — spiked GPU
                // memory and crashed the iOS Safari WebKit process ("A problem
                // repeatedly occurred"). Only opacity animates now.
                'relative rounded p-1.5 cursor-pointer select-none transition-opacity',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ring',
                // Selected block: fixed coral ring with a background-colored
                // offset gap. Coral pops over any cusip hue in both light and
                // dark themes (theme primary was near-black in light and read
                // as unclear; tile-derived color was ~always white).
                isActive &&
                    'ring-4 ring-[#ff7f50] ring-offset-2 ring-offset-background z-10',
                // Spotlight: when another cusip is selected, fade this one so
                // the active trail dominates by contrast. Opacity ONLY — a CSS
                // filter (saturate) here promoted every dimmed cell to its own
                // GPU compositing layer; across hundreds of cells that OOM-
                // crashed mobile WebKit. Opacity dims enough on its own.
                isDimmed && 'opacity-35'
            )}
            style={{ backgroundColor: bg, color: textColor }}
            title={`${label} (${cusip})`}
        >
            <div className="text-[10px] font-bold leading-tight">#{rank}</div>
            <div
                className="text-[10px] leading-tight truncate max-w-[110px]"
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
            {badge && <CellBadges badge={badge} />}
        </div>
    );
}
