// Purpose: detect MACD/Signal line crossover events.
// Buy: MACD crosses above Signal (bullish).
// Sell: MACD crosses below Signal (bearish).

export interface MacdSignal {
  index: number
  type: 'buy' | 'sell'
}

export function computeMacdSignals(
  macd: (number | null)[],
  signal: (number | null)[],
): MacdSignal[] {
  const out: MacdSignal[] = []
  for (let i = 1; i < macd.length; i++) {
    const m0 = macd[i - 1]
    const m1 = macd[i]
    const s0 = signal[i - 1]
    const s1 = signal[i]
    if (
      m0 === null || m0 === undefined || m1 === null || m1 === undefined ||
      s0 === null || s0 === undefined || s1 === null || s1 === undefined
    ) continue
    if (m0 < s0 && m1 >= s1) out.push({ index: i, type: 'buy' })
    else if (m0 > s0 && m1 <= s1) out.push({ index: i, type: 'sell' })
  }
  return out
}
