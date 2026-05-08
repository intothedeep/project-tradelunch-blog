// Purpose: detect RSI buy/sell crossover signals.
// Buy: cross up through oversold (was < 30, now >= 30).
// Sell: cross down through overbought (was > 70, now <= 70).

export interface RsiSignal {
  index: number
  type: 'buy' | 'sell'
}

export function computeRsiSignals(
  rsi: (number | null)[],
  oversold = 30,
  overbought = 70,
): RsiSignal[] {
  const out: RsiSignal[] = []
  for (let i = 1; i < rsi.length; i++) {
    const prev = rsi[i - 1]
    const curr = rsi[i]
    if (prev === null || prev === undefined || curr === null || curr === undefined) continue
    if (prev < oversold && curr >= oversold) out.push({ index: i, type: 'buy' })
    else if (prev > overbought && curr <= overbought) out.push({ index: i, type: 'sell' })
  }
  return out
}
