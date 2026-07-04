// helpers/screenScore.ts
// Purpose: Deterministic composite score for a 13F consensus screener candidate.
// Invariant: pure function — no I/O, no side effects, deterministic output.
// Score = 0.4*consensus + 0.3*momentum + 0.2*capTier + 0.1*lowVol.
//   momentum + lowVol are cross-sectionally-normalised [0,1] price signals
//   (see helpers/priceSignals.ts) computed by the caller. They are OPTIONAL:
//   when a candidate lacks price history (not in the tracked universe, or too
//   few bars) the caller passes null and that term is OMITTED from the sum —
//   the "partial score" contract. Components expose which terms are present so
//   callers can surface partiality. NB: partial (max 0.6) and full (max 1.0)
//   scores live on different axes, so they are NOT blended into one ranking —
//   the caller sorts into two data-availability tiers (see helpers/screenSort.ts)
//   rather than re-normalising, keeping the fixed-weight spec intact.
//
// newPositionBreadth (diagnostic — NOT a weighted term):
//   The Phase R/S backtest measured 13F new-position 21d sector-neutral t=3.15,
//   which validates the EVENT's forward return, not a weight inside this 4-term
//   composite. The `consensus` term (0.4 weight) already measures TOTAL active
//   holders — a distinct axis from "funds opening a NEW position this period".
//   Re-weighting is BLOCKED pending a composite-score backtest against this metric.
//   newPositionBreadth is surfaced in components as a diagnostic / ordinal sort
//   key (see screenSort.ts) — it NEVER enters the score accumulation.

export interface ScoreComponents {
    consensus: number;           // [0,1] holderCountActive / totalActiveFunds, clamped
    capTier: number;             // 0 | 0.5 | 1 — derived from global rank tier
    momentum: number | null;     // [0,1] normalised 12-1M momentum, or null (no history)
    lowVol: number | null;       // [0,1] normalised inverse-volatility, or null (no history)
    newPositionBreadth: number | null; // [0,1] distinct-new-position funds / totalActiveFunds;
                                       // null when newHolderCountActive absent (no MV) — "no data"
                                       // is distinct from 0 (zero new holders this period)
}

export interface ScoreResult {
    score: number;          // weighted sum of the PRESENT terms (see header)
    components: ScoreComponents;
}

export interface ScoreInput {
    holderCountActive: number;
    totalActiveFunds: number;      // COUNT of is_active_manager=true rows in fund_registry
    rank: number | null;           // global market_rankings rank; null when ticker not resolved
    momentum?: number | null;      // pre-normalised [0,1]; omit/null when no price history
    lowVol?: number | null;        // pre-normalised [0,1]; omit/null when no price history
    newHolderCountActive?: number | null; // distinct funds opening a NEW 13F position this period;
                                          // null/undefined when mv_sec_new_positions is absent
}

const W_CONSENSUS = 0.4;
const W_MOMENTUM = 0.3;
const W_CAP_TIER = 0.2;
const W_LOW_VOL = 0.1;

function computeConsensus(holderCountActive: number, totalActiveFunds: number): number {
    if (totalActiveFunds <= 0) return 0;
    return Math.min(1, Math.max(0, holderCountActive / totalActiveFunds));
}

function computeCapTier(rank: number | null): number {
    if (rank === null) return 0;
    if (rank <= 20) return 1;
    if (rank <= 100) return 0.5;
    return 0;
}

// newHolderCountActive absent (null/undefined) → null ("no data"), not 0.
// totalActiveFunds <= 0 → null (avoid divide-by-zero; same guard as computeConsensus).
function computeNewPositionBreadth(
    newHolderCountActive: number | null | undefined,
    totalActiveFunds: number
): number | null {
    if (newHolderCountActive === null || newHolderCountActive === undefined) return null;
    if (totalActiveFunds <= 0) return null;
    return Math.min(1, Math.max(0, newHolderCountActive / totalActiveFunds));
}

export function computeScore(input: ScoreInput): ScoreResult {
    const consensus = computeConsensus(input.holderCountActive, input.totalActiveFunds);
    const capTier = computeCapTier(input.rank);
    const momentum = input.momentum ?? null;
    const lowVol = input.lowVol ?? null;

    // score accumulation — fixed weights; newPositionBreadth deliberately excluded
    // (diagnostic only; re-weighting blocked pending composite backtest).
    let score = W_CONSENSUS * consensus + W_CAP_TIER * capTier;
    if (momentum !== null) score += W_MOMENTUM * momentum;
    if (lowVol !== null) score += W_LOW_VOL * lowVol;

    const newPositionBreadth = computeNewPositionBreadth(
        input.newHolderCountActive,
        input.totalActiveFunds
    );

    return { score, components: { consensus, capTier, momentum, lowVol, newPositionBreadth } };
}
