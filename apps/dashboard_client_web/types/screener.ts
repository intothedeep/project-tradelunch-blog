// types/screener.ts
// Purpose: Shared TS interfaces for the 13F consensus screener endpoint contract.
// Invariant: mirrors GET /v1/api/securities/screen exactly.
//   data:null is valid (views absent) → { ok:true, data:null }.
// momentum + lowVol are cross-sectionally-normalised [0,1] price signals, or
//   null when the security is outside the tracked price universe / has < ~1yr
//   of history (partial-score contract — those terms are omitted from the sum).
// Side effects: none (type declarations only).

export interface ScoreComponents {
    consensus: number; // [0,1] holderCountActive / totalActiveFunds
    capTier: number; // 0 | 0.5 | 1 — derived from global rank tier
    momentum: number | null; // [0,1] normalised 12-1M momentum, or null (no price history)
    lowVol: number | null; // [0,1] normalised inverse-volatility, or null (no price history)
}

export interface ScreenerCandidate {
    cusip: string;
    name: string;
    ticker: string | null; // null when security_map not yet seeded for this CUSIP
    rank: number | null; // global market_rankings rank; null when ticker absent
    marketCap: number | null;
    holderCountActive: number;
    holderCountTotal: number;
    score: number; // 0.4*consensus + 0.3*momentum + 0.2*capTier + 0.1*lowVol (present terms only)
    components: ScoreComponents;
}

export interface ScreenerData {
    periodOfReport: string; // 'YYYY-MM-DD'
    totalActiveFunds: number; // count of is_active_manager=true in fund_registry
    candidates: ScreenerCandidate[];
}
