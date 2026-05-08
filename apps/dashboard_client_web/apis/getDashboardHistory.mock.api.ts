// Purpose: Static 250-day OHLC mock candle history for all 22 dashboard items.
// Constraints: no Math.random() — deterministic seeded LCG walk.
// Date generation uses a fixed end-date constant so it's SSR-stable.
// 250 days lets MA200 render ~50 visible values.

import type { IDashboardOHLCHistory, IOHLCPoint } from '@/types/history'

const TOTAL_DAYS = 250
const MS_PER_DAY = 86_400_000
const END_DATE_MS = Date.UTC(2026, 4, 6)

const DATES: readonly string[] = Array.from({ length: TOTAL_DAYS }, (_, i) => {
  const offset = TOTAL_DAYS - 1 - i
  const ms = END_DATE_MS - offset * MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
})

function lcgStep(seed: number): { next: number; drift: number; jitter: number } {
  const next = (seed * 1664525 + 1013904223) & 0x7fffffff
  const drift = (next % 2001 - 1000) / 20000
  const jitter = ((next >> 8) % 500) / 100000
  return { next, drift, jitter }
}

function round6(n: number): number {
  return parseFloat(n.toPrecision(6))
}

function calcVolume(labelIndex: number, dayIndex: number, seed: number): number {
  const volSeed = (seed ^ (dayIndex * 6364136223846793005 + 1442695040888963407)) & 0x7fffffff
  const base = 100_000 + (labelIndex * 450_000)
  const variation = (volSeed % 9_000_000)
  return Math.floor(base + variation)
}

function buildCandles(labelIndex: number, endValue: number): IOHLCPoint[] {
  const offsetRatio = ((labelIndex * 13 + 7) % 40 - 20) / 100
  let price = endValue * (1 - offsetRatio)
  let seed = (labelIndex + 1) * 31337

  const candles: IOHLCPoint[] = []

  for (let i = 0; i < TOTAL_DAYS - 1; i++) {
    const { next, drift, jitter } = lcgStep(seed)
    seed = next

    const open = round6(Math.abs(price))
    const close = round6(Math.abs(open * (1 + drift)))

    const bodyHigh = Math.max(open, close)
    const bodyLow = Math.min(open, close)
    const high = round6(bodyHigh * (1 + jitter))
    const low = round6(bodyLow * (1 - jitter))
    const volume = calcVolume(labelIndex, i, seed)

    candles.push({ time: DATES[i] as string, open, high, low, close, volume })
    price = close
  }

  const lastOpen = round6(Math.abs(price))
  const lastClose = endValue
  const lastBodyHigh = Math.max(lastOpen, lastClose)
  const lastBodyLow = Math.min(lastOpen, lastClose)
  const { jitter: lastJitter, next: lastNext } = lcgStep(seed)
  const lastHigh = round6(lastBodyHigh * (1 + lastJitter))
  const lastLow = round6(lastBodyLow * (1 - lastJitter))
  const lastVolume = calcVolume(labelIndex, TOTAL_DAYS - 1, lastNext)

  candles.push({
    time: DATES[TOTAL_DAYS - 1] as string,
    open: lastOpen,
    high: lastHigh,
    low: lastLow,
    close: lastClose,
    volume: lastVolume,
  })

  return candles
}

const ENTRIES: readonly [string, number][] = [
  ['KRW/USD',          1374.50],
  ['EUR/USD',          1.0812],
  ['BTC/USD',          96420.00],
  ['BTC/ETH',          27.84],
  ['KOSPI',            2612.35],
  ['KOSDAQ',           754.80],
  ['NASDAQ',           19283.40],
  ['S&P 500',          5567.19],
  ['Dow Jones',        41218.83],
  ['Korea Call Rate',  2.75],
  ['US Fed Funds',     4.50],
  ['Japan Call Rate',  0.50],
  ['Alphabet',         178.42],
  ['Tesla',            248.75],
  ['Apple',            213.18],
  ['Amazon',           199.64],
  ['Meta',             594.30],
  ['NuScale',          26.85],
  ['TQQQ',             62.40],
  ['SOXL',             18.73],
  ['Walmart',          101.52],
  ['NCSOFT',           192500],
]

export const MOCK_DASHBOARD_HISTORY: IDashboardOHLCHistory = Object.fromEntries(
  ENTRIES.map(([label, endValue], idx) => [label, buildCandles(idx, endValue)])
)
