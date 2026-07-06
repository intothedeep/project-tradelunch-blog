'use client';

// components/backtest/AssetPicker.client.tsx
// Purpose: pick 1–10 assets from the curated buyable universe.
// Shows data-availability start date (derived from the fetched series).
// Prevents duplicates. Blocks selection when limit (10) is reached.

import { cn } from '@/lib/utils';
import { BUYABLE_UNIVERSE } from '@/utils/backtest/universe';
import type { Holding } from '@/types/backtest';

interface AssetPickerProps {
    holdings: Holding[];
    seriesFirstDate: Record<string, string>; // label → first available date
    onChange: (holdings: Holding[]) => void;
}

const MAX_ASSETS = 10;
const ETF_CATEGORY = 'etf' as const;

export default function AssetPicker({
    holdings,
    seriesFirstDate,
    onChange,
}: AssetPickerProps) {
    const selectedLabels = new Set(holdings.map((h) => h.label));

    function toggleAsset(label: string) {
        if (selectedLabels.has(label)) {
            // Remove asset
            const next = holdings.filter((h) => h.label !== label);
            onChange(equaliseWeights(next));
        } else {
            // Add asset (guard limit)
            if (holdings.length >= MAX_ASSETS) return;
            const next = [...holdings, { label, weightPct: 0, drip: false }];
            onChange(equaliseWeights(next));
        }
    }

    const etfs = BUYABLE_UNIVERSE.filter((a) => a.category === ETF_CATEGORY);
    const stocks = BUYABLE_UNIVERSE.filter((a) => a.category !== ETF_CATEGORY);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                    Assets ({holdings.length}/{MAX_ASSETS})
                </span>
                {holdings.length >= MAX_ASSETS && (
                    <span className="text-xs text-muted-foreground">
                        Limit reached
                    </span>
                )}
            </div>

            <AssetGroup
                title="ETFs"
                assets={etfs}
                selectedLabels={selectedLabels}
                seriesFirstDate={seriesFirstDate}
                atLimit={holdings.length >= MAX_ASSETS}
                onToggle={toggleAsset}
            />
            <AssetGroup
                title="Stocks"
                assets={stocks}
                selectedLabels={selectedLabels}
                seriesFirstDate={seriesFirstDate}
                atLimit={holdings.length >= MAX_ASSETS}
                onToggle={toggleAsset}
            />
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function equaliseWeights(holdings: Holding[]): Holding[] {
    if (holdings.length === 0) return [];
    const base = Math.floor(100 / holdings.length);
    const remainder = 100 - base * holdings.length;
    return holdings.map((h, i) => ({
        ...h,
        weightPct: i === 0 ? base + remainder : base,
    }));
}

interface GroupProps {
    title: string;
    assets: typeof BUYABLE_UNIVERSE;
    selectedLabels: Set<string>;
    seriesFirstDate: Record<string, string>;
    atLimit: boolean;
    onToggle: (label: string) => void;
}

function AssetGroup({
    title,
    assets,
    selectedLabels,
    seriesFirstDate,
    atLimit,
    onToggle,
}: GroupProps) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">
                {title}
            </p>
            <div className="flex flex-wrap gap-2">
                {assets.map((asset) => {
                    const selected = selectedLabels.has(asset.label);
                    const firstDate = seriesFirstDate[asset.label];
                    const disabled = !selected && atLimit;

                    return (
                        <button
                            key={asset.label}
                            type="button"
                            onClick={() => onToggle(asset.label)}
                            disabled={disabled}
                            title={`${asset.name}${firstDate ? ` · data from ${firstDate}` : ' · no data loaded'}`}
                            className={cn(
                                'flex flex-col items-start rounded border px-2.5 py-1.5 text-left text-xs transition-colors',
                                selected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border hover:border-primary hover:bg-accent',
                                disabled && 'opacity-40 cursor-not-allowed',
                                asset.isLeveraged &&
                                    !selected &&
                                    'border-yellow-400'
                            )}
                        >
                            <span className="font-mono font-semibold">
                                {asset.label}
                            </span>
                            {firstDate && (
                                <span
                                    className="opacity-70"
                                    style={{ fontSize: '10px' }}
                                >
                                    from {firstDate.slice(0, 7)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
