// helpers/politicalScore.ts
// Purpose: Compute a political-interest score from v_politician_activity fields.
// Score definition (ml-engineer spec, fixed — do not alter weights without re-spec):
//   breadth   = min(1, tradedByCount / 5)          // distinct-member reach, saturates at 5
//   consensus = max(buyMembers, sellMembers) / max(1, tradedByCount)  // directional agreement [0,1]
//   score     = (0.55 * breadth + 0.30 * consensus) / 0.85
// DEFERRED: 0.15 notionalTier term omitted — requires a 90d notional aggregate not present
//   in v_politician_activity. The remaining two terms are renormalized by dividing by their
//   combined weight (0.55 + 0.30 = 0.85) so the output stays in [0,1]. When notionalTier is
//   added in a future migration, the denominator becomes 1.0 and no further change is needed
//   to callers (same interface, weights just shift).
// Invariants:
//   - Pure function: no I/O, no side effects, deterministic.
//   - tradedByCount null or 0 → returns null (no politician data → no score; never emit 0).
//   - Output in [0,1] for any valid positive integer inputs.

export interface PoliticalScoreInput {
    tradedByCount: number | null;
    buyMembers: number | null;
    sellMembers: number | null;
}

export function computePoliticalScore(input: PoliticalScoreInput): number | null {
    const { tradedByCount, buyMembers, sellMembers } = input;

    // No politician data → no score.
    if (tradedByCount === null || tradedByCount === 0) return null;

    const safeBuy  = buyMembers  ?? 0;
    const safeSell = sellMembers ?? 0;

    const breadth   = Math.min(1, tradedByCount / 5);
    const consensus = Math.max(safeBuy, safeSell) / Math.max(1, tradedByCount);
    const score     = (0.55 * breadth + 0.30 * consensus) / 0.85;

    return score;
}
