// types/screener.ts
// Purpose: Shared TS interfaces for the 13F consensus screener endpoint contract.
// Invariant: mirrors GET /v1/api/securities/screen exactly.
//   data:null is valid (views absent) → { ok:true, data:null }.
// DEFERRED: momentum + lowVol score components are always null until
//   security_map is seeded and price-history joins are implemented.
// Side effects: none (type declarations only).

export interface ScoreComponents {
    consensus: number; // [0,1] holderCountActive / totalActiveFunds
    capTier: number; // 0 | 0.5 | 1 — derived from global rank tier
    momentum: null; // DEFERRED — price-history join not yet available
    lowVol: null; // DEFERRED — price-history join not yet available
}

export interface ScreenerCandidate {
    cusip: string;
    name: string;
    ticker: string | null; // null when security_map not yet seeded for this CUSIP
    rank: number | null; // global market_rankings rank; null when ticker absent
    marketCap: number | null;
    holderCountActive: number;
    holderCountTotal: number;
    score: number; // 0.4*consensus + 0.2*capTier (max 0.6 currently)
    components: ScoreComponents;
}

export interface ScreenerData {
    periodOfReport: string; // 'YYYY-MM-DD'
    totalActiveFunds: number; // count of is_active_manager=true in fund_registry
    candidates: ScreenerCandidate[];
}
