// Purpose: Jotai atoms for dashboard shared client state.
// Convention: store/ is the canonical location for all atoms in this repo.

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const selectedLabelAtom = atom<string | null>(null);

export type WatchlistSection = 'FX' | 'Crypto' | 'Indices' | 'Rates' | 'Stocks';

export const watchlistOpenAtom = atomWithStorage<
    Record<WatchlistSection, boolean>
>('dashboard.watchlistOpen', {
    FX: true,
    Crypto: true,
    Indices: true,
    Rates: true,
    Stocks: true,
});

export type ChartRange =
    | '1D'
    | '5D'
    | '1M'
    | '3M'
    | '6M'
    | 'YTD'
    | '1Y'
    | '5Y'
    | 'All';

export const selectedRangeAtom = atomWithStorage<ChartRange>(
    'dashboard.chartRange',
    '6M'
);

// Maps the chart viewport range (UI) -> backend history fetch window
// (1m|3m|6m|1y|5y|max). Indicators (e.g. MA200) need ~1y of daily bars, so every
// range up to 1Y fetches '1y'; 5Y/All fetch more so the chart actually shows that
// span. Ranges sharing a fetch window share the React Query key -> switching among
// them never refetches.
export const CHART_RANGE_TO_FETCH: Record<ChartRange, string> = {
    '1D': '1y',
    '5D': '1y',
    '1M': '1y',
    '3M': '1y',
    '6M': '1y',
    YTD: '1y',
    '1Y': '1y',
    '5Y': '5y',
    All: 'max',
};

export type ChartInterval =
    | '1m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '4h'
    | 'D'
    | 'W'
    | 'M';

export const CHART_INTERVALS: readonly ChartInterval[] = [
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    'D',
    'W',
    'M',
];

export const selectedIntervalAtom = atomWithStorage<ChartInterval>(
    'dashboard.chartInterval',
    'D'
);
