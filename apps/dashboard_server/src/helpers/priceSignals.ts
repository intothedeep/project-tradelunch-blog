// helpers/priceSignals.ts
// Purpose: Pure price-derived signal terms for the 13F consensus screener
//          (Phase P, STEP 3 / P10 — the previously-deferred momentum + lowVol terms).
// Invariants:
//   - Pure functions — no I/O, no side effects, deterministic output.
//   - Inputs are ASCENDING daily closes (oldest first), tracked-universe '1d' bars.
//   - Insufficient history / non-positive prices → null (never throw, never NaN).
// Method (textbook conventions):
//   - momentum(12-1M): Jegadeesh-Titman skip-month. Return from ~12 months ago to
//     ~1 month ago, skipping the most recent ~21 trading days to avoid short-term
//     reversal. raw = close[t-SKIP] / close[t-LOOKBACK] - 1.
//   - lowVol: annualised stdev of daily log returns over the trailing ~252 bars
//     (sample stdev × sqrt(252)). Returned as positive annualised volatility; the
//     caller negates before percentile-ranking so LOWER vol scores HIGHER.
//   - Cross-sectional normalisation (percentileRank) turns raw values into [0,1]
//     relative to the current candidate set — deterministic over a fixed set, and
//     directly enables a "momentum top-50%" reading (percentile >= 0.5).
// Constraint: momentum/lowVol are relative signals — a single candidate has no
//   cross-section, so percentileRank yields a neutral 0.5.

const SKIP_BARS = 21; // ~1 trading month skipped (short-term reversal guard)
const LOOKBACK_BARS = 252; // ~12 trading months lookback
const VOL_WINDOW = 252; // trailing bars for the volatility estimate
const MIN_VOL_RETURNS = 60; // ~3 months of returns — floor for a meaningful stdev
const TRADING_DAYS = 252;

/**
 * 12-1 month momentum from ascending daily closes.
 * Requires >= LOOKBACK_BARS + 1 bars; else null.
 */
export function computeRawMomentum(closesAsc: number[]): number | null {
    const n = closesAsc.length;
    if (n < LOOKBACK_BARS + 1) return null;
    const recent = closesAsc[n - 1 - SKIP_BARS];
    const past = closesAsc[n - 1 - LOOKBACK_BARS];
    if (!(past > 0) || !(recent > 0)) return null;
    return recent / past - 1;
}

/**
 * Annualised volatility of daily log returns over the trailing VOL_WINDOW bars.
 * Requires >= MIN_VOL_RETURNS returns (MIN_VOL_RETURNS + 1 closes); else null.
 * Returns positive annualised vol, or null when any close is non-positive.
 */
export function computeAnnualizedVol(closesAsc: number[]): number | null {
    const window = closesAsc.slice(-(VOL_WINDOW + 1));
    if (window.length < MIN_VOL_RETURNS + 1) return null;

    const rets: number[] = [];
    for (let i = 1; i < window.length; i++) {
        const prev = window[i - 1];
        const cur = window[i];
        if (!(prev > 0) || !(cur > 0)) return null;
        rets.push(Math.log(cur / prev));
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance =
        rets.reduce((a, r) => a + (r - mean) * (r - mean), 0) / (rets.length - 1);
    return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
}

/**
 * Cross-sectional percentile rank in [0,1] for each non-null value: the fraction
 * of the other non-null values that are strictly less than it. Nulls stay null.
 * Deterministic; a lone non-null value ranks 0.5 (neutral — no cross-section).
 * Ties share the same rank (both count neither as "strictly less").
 */
export function percentileRank(values: (number | null)[]): (number | null)[] {
    const present = values.filter((v): v is number => v !== null);
    const denom = present.length - 1;
    return values.map((v) => {
        if (v === null) return null;
        if (denom <= 0) return 0.5;
        const lessThan = present.reduce((acc, o) => (o < v ? acc + 1 : acc), 0);
        return lessThan / denom;
    });
}
