export function computeRSI(
    closes: number[],
    period: number = 14
): (number | null)[] {
    const result: (number | null)[] = new Array(closes.length).fill(null);
    if (closes.length <= period) return result;
    for (let i = period; i < closes.length; i++) {
        let gain = 0;
        let loss = 0;
        for (let k = i - period + 1; k <= i; k++) {
            const delta = (closes[k] as number) - (closes[k - 1] as number);
            if (delta > 0) gain += delta;
            else loss -= delta;
        }
        if (loss === 0) {
            result[i] = 100;
        } else {
            const rs = gain / loss;
            result[i] = 100 - 100 / (1 + rs);
        }
    }
    return result;
}
