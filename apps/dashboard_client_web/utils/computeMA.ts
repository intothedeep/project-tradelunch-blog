// Purpose: Pure helper to compute simple moving average over a closes array.
// Invariants: input array is ordered oldest-first. Returns null for indices
//             where fewer than `period` data points are available (i < period-1).
// Side effects: none.

export function computeMA(closes: number[], period: number): (number | null)[] {
    return closes.map((_, i) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let k = i - period + 1; k <= i; k++) {
            sum += closes[k] as number;
        }
        return sum / period;
    });
}
