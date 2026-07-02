// helpers/screenSort.ts
// Purpose: Deterministic ordering for screener candidates that keeps two
//   NON-COMPARABLE score axes apart instead of blending them.
// Invariant: pure functions — no I/O, deterministic.
// Why two tiers (PM + architect joint decision, 2026-07-02):
//   A candidate WITH price history is scored on all four terms (max 1.0); one
//   WITHOUT is scored only on consensus + capTier (max 0.6). Those maxima live
//   on different axes — a partial 0.6 and a full 0.6 do NOT mean the same thing.
//   Blending them into one sorted list lets a mediocre tracked name outrank a
//   strong untracked one purely for being in the price universe. So we sort
//   price-signal-complete candidates first, consensus-only after — a DATA-
//   AVAILABILITY split, NOT a quality verdict (the UI must frame it that way).
//   The score formula (computeScore) is untouched — functional-core stays pure.

import type { ScoreComponents } from './screenScore';

/**
 * A candidate is "price-signal complete" only when BOTH price terms are
 * present. A rare one-sided case (only momentum, or only lowVol) falls to the
 * consensus-only tier so tier 1 stays fully comparable.
 */
export function hasPriceSignals(c: ScoreComponents): boolean {
    return c.momentum !== null && c.lowVol !== null;
}

interface SortableCandidate {
    score: number;
    holderCountActive: number;
    components: ScoreComponents;
}

/**
 * Order: (1) price-signal-complete first, (2) score DESC, (3) holderCountActive
 * DESC. Stable and deterministic for a fixed candidate set.
 */
export function compareScreenCandidates(
    a: SortableCandidate,
    b: SortableCandidate
): number {
    const aHas = hasPriceSignals(a.components);
    const bHas = hasPriceSignals(b.components);
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.holderCountActive - a.holderCountActive;
}
