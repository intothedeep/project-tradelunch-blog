// helpers/valueBand.ts
// Purpose: Map a raw USD amount to a coarse disclosure band string.
//          PTR filings report dollar ranges, not exact amounts; the band
//          preserves that coarseness and avoids projecting false precision.
// Invariants:
//   - null → '—'  (no disclosure data; unknown / not applicable)
//   - 0   → '<$15K'  (zero is within the lowest band)
//   - Bands mirror the PTR statutory range brackets:
//       <15 000            → '<$15K'
//       15 000 – 49 999    → '$15K–$50K'
//       50 000 – 249 999   → '$50K–$250K'
//       250 000 – 999 999  → '$250K–$1M'
//       ≥ 1 000 000        → '>$1M'
//   - bigint input: converted via Number() — safe because band boundaries
//     are well below 2^53.
// Side effects: none.

export type ValueBand = '<$15K' | '$15K–$50K' | '$50K–$250K' | '$250K–$1M' | '>$1M' | '—';

/**
 * Converts a raw USD amount to a coarse disclosure band string.
 * null → '—'; 0 and small positives → '<$15K'.
 */
export function toValueBand(usd: number | null | bigint): ValueBand {
    if (usd === null) return '—';
    const n = typeof usd === 'bigint' ? Number(usd) : usd;
    if (n < 15_000) return '<$15K';
    if (n < 50_000) return '$15K–$50K';
    if (n < 250_000) return '$50K–$250K';
    if (n < 1_000_000) return '$250K–$1M';
    return '>$1M';
}
