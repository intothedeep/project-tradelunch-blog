// Purpose: Jotai atoms for dashboard shared client state.
// Convention: store/ is the canonical location for all atoms in this repo.

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const selectedLabelAtom = atom<string | null>(null)

export type WatchlistSection = 'FX' | 'Crypto' | 'Indices' | 'Rates' | 'Stocks'

export const watchlistOpenAtom = atomWithStorage<Record<WatchlistSection, boolean>>(
  'dashboard.watchlistOpen',
  { FX: true, Crypto: true, Indices: true, Rates: true, Stocks: true },
)

export type ChartRange = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'All'

export const selectedRangeAtom = atomWithStorage<ChartRange>('dashboard.chartRange', '6M')

export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | 'D' | 'W' | 'M'

export const CHART_INTERVALS: readonly ChartInterval[] = [
  '1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M',
]

export const selectedIntervalAtom = atomWithStorage<ChartInterval>('dashboard.chartInterval', 'D')
