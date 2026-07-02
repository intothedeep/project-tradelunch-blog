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
//   scores are sorted together — a documented limitation, not normalised away,
//   to keep the fixed-weight spec. Most tracked large-caps carry full history.

export interface ScoreComponents {
    consensus: number;      // [0,1] holderCountActive / totalActiveFunds, clamped
    capTier: number;        // 0 | 0.5 | 1 — derived from global rank tier
    momentum: number | null; // [0,1] normalised 12-1M momentum, or null (no history)
    lowVol: number | null;   // [0,1] normalised inverse-volatility, or null (no history)
}

export interface ScoreResult {
    score: number;          // weighted sum of the PRESENT terms (see header)
    components: ScoreComponents;
}

export interface ScoreInput {
    holderCountActive: number;
    totalActiveFunds: number;  // COUNT of is_active_manager=true rows in fund_registry
    rank: number | null;       // global market_rankings rank; null when ticker not resolved
    momentum?: number | null;  // pre-normalised [0,1]; omit/null when no price history
    lowVol?: number | null;    // pre-normalised [0,1]; omit/null when no price history
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

export function computeScore(input: ScoreInput): ScoreResult {
    const consensus = computeConsensus(input.holderCountActive, input.totalActiveFunds);
    const capTier = computeCapTier(input.rank);
    const momentum = input.momentum ?? null;
    const lowVol = input.lowVol ?? null;

    let score = W_CONSENSUS * consensus + W_CAP_TIER * capTier;
    if (momentum !== null) score += W_MOMENTUM * momentum;
    if (lowVol !== null) score += W_LOW_VOL * lowVol;

    return { score, components: { consensus, capTier, momentum, lowVol } };
}
