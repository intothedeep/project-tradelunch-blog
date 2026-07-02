// helpers/screenScore.ts
// Purpose: Deterministic composite score for a 13F consensus screener candidate.
// Invariant: pure function — no I/O, no side effects, deterministic output.
// DEFERRED score terms (require security_map price-history join):
//   momentum (12-1M) — 12-month minus 1-month excess return; target weight 0.3
//   lowVol            — inverse annualised return volatility;  target weight 0.1
// Current sum = 0.4 * consensus + 0.2 * capTier (max possible = 0.6 until
// deferred terms resolve). Components are returned explicitly as null for
// deferred terms so callers can surface "partial score" to the user.

export interface ScoreComponents {
    consensus: number;  // [0,1] holderCountActive / totalActiveFunds, clamped
    capTier: number;    // 0 | 0.5 | 1 — derived from global rank tier
    momentum: null;     // DEFERRED — requires price-history join via security_map
    lowVol: null;       // DEFERRED — requires price-history join via security_map
}

export interface ScoreResult {
    score: number;          // 0.4*consensus + 0.2*capTier (max 0.6 currently)
    components: ScoreComponents;
}

export interface ScoreInput {
    holderCountActive: number;
    totalActiveFunds: number;  // COUNT of is_active_manager=true rows in fund_registry
    rank: number | null;       // global market_rankings rank; null when ticker not resolved
}

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
    // momentum (0.3) + lowVol (0.1) DEFERRED — omitted from sum, documented above.
    const score = 0.4 * consensus + 0.2 * capTier;
    return {
        score,
        components: { consensus, capTier, momentum: null, lowVol: null },
    };
}
