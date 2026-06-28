'use client';

// Purpose: TradingView-style top header bar for the chart panel.
// Shows ticker, current price, change, timeframe pill buttons, and indicator settings.

import type { RefObject } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Menu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/chart-format';
import { CHART_INTERVALS, selectedIntervalAtom } from '@/store/dashboard.atom';
import { isMenuDrawerOpenAtom } from '@/store/menu.atom';

interface Props {
    label: string;
    lastClose: number;
    change: number;
    changePercent: number;
    menuOpen: boolean;
    onToggleMenu: () => void;
    gearRef: RefObject<HTMLButtonElement | null>;
}

export default function ChartHeader({
    label,
    lastClose,
    change,
    changePercent,
    menuOpen,
    onToggleMenu,
    gearRef,
}: Props) {
    const [selectedInterval, setSelectedInterval] =
        useAtom(selectedIntervalAtom);
    const openMenu = useSetAtom(isMenuDrawerOpenAtom);
    const isPos = change >= 0;
    const changeColor = isPos ? 'text-[#26a69a]' : 'text-[#ef5350]';
    const changeSign = isPos ? '+' : '';

    return (
        <div className="flex items-center justify-center md:justify-start gap-4 px-3 py-2 bg-white dark:bg-[#1e222d] border-b border-[#e0e3eb] dark:border-[#2a2e39] flex-wrap">
            {/* Menu (desktop only) — opens the shared MenuDrawer for site nav.
                On mobile the global mobile bar + floating button handle nav. */}
            <button
                type="button"
                onClick={() => openMenu(true)}
                aria-label="Open navigation menu"
                className="hidden md:inline-flex items-center justify-center w-6 h-6 rounded text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
            >
                <Menu size={14} />
            </button>

            <div className="flex items-baseline gap-2">
                <span className="text-[#131722] dark:text-[#d1d4dc] font-bold text-base">
                    {label}
                </span>
                <span className="text-[#131722] dark:text-[#d1d4dc] font-semibold text-sm tabular-nums">
                    {formatPrice(lastClose)}
                </span>
                <span className={cn('text-xs tabular-nums', changeColor)}>
                    {changeSign}
                    {formatPrice(change)} ({changeSign}
                    {changePercent.toFixed(2)}%)
                </span>
            </div>

            <div className="flex items-center gap-0.5 md:ml-auto">
                {CHART_INTERVALS.map((tf) => (
                    <button
                        key={tf}
                        type="button"
                        onClick={() => setSelectedInterval(tf)}
                        className={cn(
                            'px-2 py-0.5 text-xs rounded',
                            tf === selectedInterval
                                ? 'bg-[#2962ff] text-white font-semibold'
                                : 'text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                        )}
                    >
                        {tf}
                    </button>
                ))}
                <span className="mx-1 h-4 w-px bg-[#e0e3eb] dark:bg-[#2a2e39]" />
                <button
                    ref={gearRef}
                    type="button"
                    onClick={onToggleMenu}
                    aria-label="Indicator settings"
                    aria-expanded={menuOpen}
                    className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded',
                        menuOpen
                            ? 'bg-black/[0.06] dark:bg-white/[0.06] text-[#131722] dark:text-[#d1d4dc]'
                            : 'text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    )}
                >
                    <Settings size={14} />
                </button>
            </div>
        </div>
    );
}
