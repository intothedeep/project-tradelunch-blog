// Purpose: Compute Ichimoku Kinko Hyo lines aligned to the candle index space.
// All output arrays match candles.length. Senkou A/B are forward-shifted by
// `displacement`; Chikou is backward-shifted. Bars without enough data are null.
// No future projection beyond the last candle is performed (no synthesized times).

export interface IchimokuResult {
  tenkan: (number | null)[]
  kijun: (number | null)[]
  senkouA: (number | null)[]
  senkouB: (number | null)[]
  chikou: (number | null)[]
}

interface OHLC { high: number; low: number; close: number }

function midpointHL(values: OHLC[], i: number, period: number): number | null {
  if (i < period - 1) return null
  let hi = -Infinity
  let lo = Infinity
  for (let k = i - period + 1; k <= i; k++) {
    const v = values[k]
    if (v === undefined) return null
    if (v.high > hi) hi = v.high
    if (v.low < lo) lo = v.low
  }
  return (hi + lo) / 2
}

export function computeIchimoku(
  candles: OHLC[],
  conversionPeriod = 9,
  basePeriod = 26,
  spanBPeriod = 52,
  displacement = 26,
): IchimokuResult {
  const n = candles.length
  const tenkan: (number | null)[] = new Array(n).fill(null)
  const kijun: (number | null)[] = new Array(n).fill(null)
  const rawSenkouA: (number | null)[] = new Array(n).fill(null)
  const rawSenkouB: (number | null)[] = new Array(n).fill(null)
  const chikou: (number | null)[] = new Array(n).fill(null)

  for (let i = 0; i < n; i++) {
    const t = midpointHL(candles, i, conversionPeriod)
    const k = midpointHL(candles, i, basePeriod)
    tenkan[i] = t
    kijun[i] = k
    rawSenkouA[i] = t !== null && k !== null ? (t + k) / 2 : null
    rawSenkouB[i] = midpointHL(candles, i, spanBPeriod)
  }

  const senkouA: (number | null)[] = new Array(n).fill(null)
  const senkouB: (number | null)[] = new Array(n).fill(null)
  for (let i = displacement; i < n; i++) {
    senkouA[i] = rawSenkouA[i - displacement] ?? null
    senkouB[i] = rawSenkouB[i - displacement] ?? null
  }

  for (let i = 0; i + displacement < n; i++) {
    chikou[i] = candles[i + displacement]?.close ?? null
  }

  return { tenkan, kijun, senkouA, senkouB, chikou }
}
