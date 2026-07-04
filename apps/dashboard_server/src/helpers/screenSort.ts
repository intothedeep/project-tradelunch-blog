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
//
// newPositionBreadth tiebreak (2026-07-03):
//   Phase R/S backtest: 13F new-position 21d sector-neutral t=3.15 (above Harvey-
//   Liu-Zhu t>3 bar). This validates an ORDINAL preference for tickers where more
//   funds are opening new positions vs. simply holding. It is NOT a composite-score
//   weight — re-weighting is blocked pending a composite backtest. Applied here as
//   a tiebreak (tier → score DESC → newPositionBreadth DESC → holderCountActive DESC)
//   so the underlying score formula remains byte-for-byte identical.

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
    newPositionBreadth: number | null; // from components.newPositionBreadth; nulls sort last
    components: ScoreComponents;
}

/**
 * Order: (1) price-signal-complete first, (2) score DESC,
 * (3) newPositionBreadth DESC (nulls last — "no data" < any measured value),
 * (4) holderCountActive DESC.
 * Stable and deterministic for a fixed candidate set.
 */
export function compareScreenCandidates(
    a: SortableCandidate,
    b: SortableCandidate
): number {
    // Tier: price-signal-complete candidates rank first.
    const aHas = hasPriceSignals(a.components);
    const bHas = hasPriceSignals(b.components);
    if (aHas !== bHas) return aHas ? -1 : 1;

    // Score DESC.
    if (b.score !== a.score) return b.score - a.score;

    // newPositionBreadth DESC — nulls sort last (no MV = less information, demote).
    const aNpb = a.newPositionBreadth;
    const bNpb = b.newPositionBreadth;
    if (aNpb !== bNpb) {
        if (aNpb === null) return 1;   // a has no data → a goes later
        if (bNpb === null) return -1;  // b has no data → b goes later
        return bNpb - aNpb;            // both present → higher breadth first
    }

    // holderCountActive DESC — final tiebreak.
    return b.holderCountActive - a.holderCountActive;
}
