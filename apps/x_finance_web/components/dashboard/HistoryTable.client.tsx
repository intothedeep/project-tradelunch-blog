'use client';

import { useAtom } from 'jotai';
import {
    Banknote,
    Bitcoin,
    BarChart3,
    Percent,
    Briefcase,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    selectedLabelAtom,
    watchlistOpenAtom,
    type WatchlistSection,
} from '@/store/dashboard.atom';
import type { IDashboardSnapshot, IDashboardItem } from '@/types/dashboard';

interface Props {
    snapshot: IDashboardSnapshot;
    className?: string;
}

const SECTION_ICONS: Record<WatchlistSection, LucideIcon> = {
    FX: Banknote,
    Crypto: Bitcoin,
    Indices: BarChart3,
    Rates: Percent,
    Stocks: Briefcase,
};

const SECTION_TINTS: Record<WatchlistSection, string> = {
    FX: '#2962ff',
    Crypto: '#f7931a',
    Indices: '#26a69a',
    Rates: '#ab47bc',
    Stocks: '#787b86',
};

function ItemIcon({ section }: { section: WatchlistSection }) {
    const Icon = SECTION_ICONS[section];
    return (
        <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-white"
            style={{ backgroundColor: SECTION_TINTS[section] }}
        >
            <Icon
                size={10}
                strokeWidth={2.5}
            />
        </span>
    );
}

function formatLast(v: number): string {
    if (v >= 1000)
        return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (v >= 1) return v.toFixed(2);
    return v.toPrecision(4);
}

function formatChg(v: number): string {
    const sign = v >= 0 ? '+' : '';
    if (Math.abs(v) >= 1) return `${sign}${v.toFixed(2)}`;
    return `${sign}${v.toPrecision(3)}`;
}

interface SectionProps {
    heading: WatchlistSection;
    items: IDashboardItem[];
    selected: string | null;
    onSelect: (label: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

function Section({
    heading,
    items,
    selected,
    onSelect,
    isOpen,
    onToggle,
}: SectionProps) {
    return (
        <>
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-1 px-2 py-1 text-[11px] text-[#787b86] bg-[#f0f3fa] dark:bg-[#1e222d] hover:bg-[#e7eaf3] dark:hover:bg-[#252834] uppercase tracking-wide"
            >
                <span className="inline-block w-3 text-center">
                    {isOpen ? '▼' : '▶'}
                </span>
                <span>{heading}</span>
            </button>
            {isOpen &&
                items.map((item) => {
                    const isPos = item.change.percent >= 0;
                    const numColor = isPos
                        ? 'text-[#26a69a]'
                        : 'text-[#ef5350]';
                    const isSelected = item.label === selected;
                    return (
                        <div
                            key={item.label}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelect(item.label)}
                            onKeyDown={(e) =>
                                e.key === 'Enter' && onSelect(item.label)
                            }
                            className={cn(
                                'grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 px-2 cursor-pointer h-7',
                                isSelected
                                    ? 'bg-[rgba(41,98,255,0.10)]'
                                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                            )}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <ItemIcon section={heading} />
                                <span className="text-[#131722] dark:text-[#d1d4dc] text-xs font-semibold truncate">
                                    {item.label}
                                </span>
                            </div>
                            <span className="text-[#131722] dark:text-[#d1d4dc] text-xs tabular-nums font-mono text-right">
                                {formatLast(item.value)}
                            </span>
                            <span
                                className={cn(
                                    'text-xs tabular-nums font-mono text-right',
                                    numColor
                                )}
                            >
                                {formatChg(item.change.absolute)}
                            </span>
                            <span
                                className={cn(
                                    'text-xs tabular-nums font-mono text-right w-14',
                                    numColor
                                )}
                            >
                                {item.change.percent >= 0 ? '+' : ''}
                                {item.change.percent.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
        </>
    );
}

const SECTIONS: readonly WatchlistSection[] = [
    'FX',
    'Crypto',
    'Indices',
    'Rates',
    'Stocks',
];

export default function HistoryTable({ snapshot, className }: Props) {
    const [selected, setSelected] = useAtom(selectedLabelAtom);
    const [open, setOpen] = useAtom(watchlistOpenAtom);

    const toggle = (key: WatchlistSection) =>
        setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

    const itemsBySection: Record<WatchlistSection, IDashboardItem[]> = {
        FX: snapshot.fx.items,
        Crypto: snapshot.crypto.items,
        Indices: snapshot.indices.items,
        Rates: snapshot.rates.items,
        Stocks: snapshot.stocks.items,
    };

    return (
        <div
            className={cn(
                'flex flex-col bg-white dark:bg-[#1e222d] text-[#131722] dark:text-[#d1d4dc] text-sm',
                className
            )}
        >
            <div className="sticky top-0 z-10 bg-white dark:bg-[#1e222d] border-b border-[#e0e3eb] dark:border-[#2a2e39]">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-2 py-1.5">
                    <span className="text-[10px] font-semibold tracking-widest text-[#787b86] uppercase">
                        Watching
                    </span>
                    <span className="text-[10px] text-[#787b86] uppercase text-right">
                        Last
                    </span>
                    <span className="text-[10px] text-[#787b86] uppercase text-right">
                        Chg
                    </span>
                    <span className="text-[10px] text-[#787b86] uppercase text-right w-14">
                        Chg%
                    </span>
                </div>
            </div>

            {SECTIONS.map((section) => (
                <Section
                    key={section}
                    heading={section}
                    items={itemsBySection[section]}
                    selected={selected}
                    onSelect={setSelected}
                    isOpen={open[section]}
                    onToggle={() => toggle(section)}
                />
            ))}
        </div>
    );
}
