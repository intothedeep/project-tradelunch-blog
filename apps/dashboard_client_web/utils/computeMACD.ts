import { computeEMA } from '@/utils/computeEMA'
import type { MACDResult } from '@/types/dashboard'

export type { MACDResult }

export function computeMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): MACDResult {
  const fastEMA = computeEMA(closes, fast)
  const slowEMA = computeEMA(closes, slow)
  const macd = closes.map((_, i) => {
    const f = fastEMA[i]
    const s = slowEMA[i]
    return f !== null && f !== undefined && s !== null && s !== undefined ? f - s : null
  })

  const signalLine: (number | null)[] = new Array(closes.length).fill(null)
  const compactMACD: number[] = []
  let firstMacdIdx = -1
  for (let i = 0; i < macd.length; i++) {
    const v = macd[i]
    if (v !== null && v !== undefined) {
      if (firstMacdIdx < 0) firstMacdIdx = i
      compactMACD.push(v)
    }
  }
  if (firstMacdIdx >= 0 && compactMACD.length >= signal) {
    const signalCompact = computeEMA(compactMACD, signal)
    for (let i = 0; i < signalCompact.length; i++) {
      signalLine[firstMacdIdx + i] = signalCompact[i] ?? null
    }
  }

  const histogram = macd.map((m, i) => {
    const s = signalLine[i]
    return m !== null && m !== undefined && s !== null && s !== undefined ? m - s : null
  })

  return { macd, signal: signalLine, histogram }
}
