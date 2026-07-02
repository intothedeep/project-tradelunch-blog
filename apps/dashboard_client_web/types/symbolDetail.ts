// types/symbolDetail.ts
// Purpose: Shared TS interfaces for the per-ticker detail endpoint contract.
// Invariant: mirrors GET /v1/api/securities/:ticker/by-ticker exactly.
//   data:null is valid (unknown ticker / tables absent) → { ok:true, data:null }.
// Side effects: none (type declarations only).

export interface SymbolRankingEntry {
    asOf: string; // 'YYYY-MM-DD'
    scope: string; // 'global' (only global-scope rows are returned)
    rank: number;
    marketCap: number | null;
}

export interface SymbolHolder {
    cik: string;
    label: string;
    isActiveManager: boolean;
    valueUsd: number;
    weightPct: number | null; // portfolio weight % from v_sec_position_delta; null when absent
    deltaWeightPct: number | null; // quarter-over-quarter Δ weight %; null when new/absent
    isNew: boolean; // true when fund opened this position in the latest period
}

export interface SymbolDetail {
    ticker: string;
    sector: string | null; // from symbol_fundamentals via enriched view; null when absent
    rankingHistory: SymbolRankingEntry[]; // value-desc, latest-first, up to 52 weeks
    holders: SymbolHolder[]; // value-desc; empty until security_map is seeded
    periodOfReport: string | null; // 'YYYY-MM-DD' of latest 13F period; null when no holders
    priceHistory: { t: string; close: number }[]; // ascending daily closes; [] for untracked
}
