export function computeEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i] as number
  const k = 2 / (period + 1)
  result[period - 1] = sum / period
  for (let i = period; i < values.length; i++) {
    const prev = result[i - 1] as number
    result[i] = ((values[i] as number) - prev) * k + prev
  }
  return result
}
