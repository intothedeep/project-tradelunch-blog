// helpers/politicalScore.ts
// Purpose: Compute a political-interest score from v_politician_activity fields.
// Score definition (ml-engineer spec, fixed — do not alter weights without re-spec):
//   breadth      = min(1, tradedByCount / 5)                               // distinct-member reach, saturates at 5
//   consensus    = max(buyMembers, sellMembers) / max(1, tradedByCount)    // directional agreement [0,1]
//   notionalTier = 0   if notional < 250_000 (or null)                    // coarse 90d disclosed-notional proxy
//                = 0.5 if 250_000 ≤ notional < 5_000_000
//                = 1   if notional ≥ 5_000_000
//   score = 0.55 * breadth + 0.30 * consensus + 0.15 * notionalTier
// Weights sum to 1.0 — no renormalization divisor.
// notional is a COARSE proxy from disclosed-value brackets (geometric mean of ranges).
// It feeds only a 3-level tier — NEVER display as an exact dollar figure.
// Invariants:
//   - Pure function: no I/O, no side effects, deterministic.
//   - tradedByCount null or 0 → returns null (no politician data → no score; never emit 0).
//   - notional null → notionalTier = 0 (counts still score; NOT a null-out condition).
//   - Output in [0,1] for any valid positive integer inputs.

export interface PoliticalScoreInput {
    tradedByCount: number | null;
    buyMembers: number | null;
    sellMembers: number | null;
    notional: number | null;
}

function computeNotionalTier(notional: number | null): number {
    if (notional === null || notional < 250_000) return 0;
    if (notional < 5_000_000) return 0.5;
    return 1;
}

export function computePoliticalScore(input: PoliticalScoreInput): number | null {
    const { tradedByCount, buyMembers, sellMembers, notional } = input;

    // No politician data → no score.
    if (tradedByCount === null || tradedByCount === 0) return null;

    const safeBuy  = buyMembers  ?? 0;
    const safeSell = sellMembers ?? 0;

    const breadth      = Math.min(1, tradedByCount / 5);
    const consensus    = Math.max(safeBuy, safeSell) / Math.max(1, tradedByCount);
    const notionalTier = computeNotionalTier(notional);
    const score        = 0.55 * breadth + 0.30 * consensus + 0.15 * notionalTier;

    return score;
}
